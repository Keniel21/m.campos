package br.com.mcampos.crm;

import java.net.URI;
import java.time.Instant;
import java.util.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.core.env.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration @Profile("web")
class WebSecurity {
    private final String origin;
    private final boolean https;
    WebSecurity(@Value("${app.web-origin}") String origin,@Value("${server.servlet.session.cookie.secure:true}") boolean secure,
        @Value("${server.address:127.0.0.1}") String bind,@Value("${app.storage-mode:local}") String storage,Environment env) {
        URI uri=URI.create(origin);
        https="https".equals(uri.getScheme());
        boolean local="http".equals(uri.getScheme())&&Set.of("localhost","127.0.0.1","[::1]").contains(uri.getHost());
        if(uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||!Set.of("","/").contains(uri.getPath())||(!https&&!local))
            throw new IllegalArgumentException("APP_ORIGIN deve ser a origem HTTPS pública ou HTTP loopback para teste.");
        if(env.acceptsProfiles(Profiles.of("desktop")))throw new IllegalArgumentException("Não combine web e desktop.");
        if(https&&(!secure||!"s3".equals(storage)))throw new IllegalArgumentException("A versão pública exige cookie seguro e armazenamento S3.");
        if(local&&!Set.of("localhost","127.0.0.1","::1").contains(bind))throw new IllegalArgumentException("Teste HTTP deve permanecer em loopback.");
        this.origin=origin.endsWith("/")?origin.substring(0,origin.length()-1):origin;
    }
    @Bean UserDetailsService webUsers(UserRepository users) {
        return email->users.findByEmail(email.trim().toLowerCase(Locale.ROOT))
            .map(user->User.withUsername(user.email).password(user.passwordHash).roles("OPERATOR").build())
            .orElseThrow(()->new UsernameNotFoundException("Credenciais inválidas."));
    }
    @Bean SecurityFilterChain webFilterChain(HttpSecurity http) throws Exception {
        return http.headers(h->h.frameOptions(f->f.sameOrigin()))
            .requestCache(c->c.disable())
            .authorizeHttpRequests(a->a.requestMatchers("/","/index.html","/app.js","/style.css","/src/**","/manifest.json","/service-worker.js","/healthz","/api/desktop/session","/api/web/login").permitAll()
                .requestMatchers(HttpMethod.POST,"/api/desktop/documents/*/local-copy").denyAll()
                .requestMatchers("/api/desktop/**").authenticated().anyRequest().denyAll())
            .formLogin(f->f.loginPage("/").loginProcessingUrl("/api/web/login").usernameParameter("email")
                .successHandler((req,res,auth)->res.setStatus(204))
                .failureHandler((req,res,error)->{res.setStatus(401);res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"error\":\"E-mail ou senha inválidos.\"}");}))
            .logout(l->l.logoutUrl("/api/web/logout").invalidateHttpSession(true).clearAuthentication(true).deleteCookies("MCAMPOS_SESSION")
                .logoutSuccessHandler((req,res,auth)->res.setStatus(204)).permitAll())
            .exceptionHandling(e->e.authenticationEntryPoint((req,res,error)->res.sendError(401))
                .accessDeniedHandler((req,res,error)->res.sendError(403)))
            .addFilterBefore(new WebRequestFilter(origin),CsrfFilter.class).build();
    }
    static class WebRequestFilter extends OncePerRequestFilter {
        private final String origin;
        private final Map<String,Window> attempts=new LinkedHashMap<>();
        record Window(long minute,int count){}
        WebRequestFilter(String origin){this.origin=origin;}
        synchronized boolean allow(String address) {
            long minute=Instant.now().getEpochSecond()/60;
            attempts.entrySet().removeIf(e->e.getValue().minute()!=minute);
            if(attempts.size()>=1024&&!attempts.containsKey(address))return false;
            Window prior=attempts.get(address);int count=prior==null?1:prior.count()+1;
            attempts.put(address,new Window(minute,count));return count<=10;
        }
        @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
            res.setHeader("Cache-Control","no-store");res.setHeader("Referrer-Policy","same-origin");
            if(origin.startsWith("https://")&&!req.isSecure()&&!"/healthz".equals(req.getRequestURI())) {
                if(!Set.of("GET","HEAD").contains(req.getMethod())){res.sendError(403);return;}
                // Redirect to the configured public origin, independently of internal proxy ports.
                res.setStatus(302);res.setHeader("Location",origin+req.getRequestURI());return;
            }
            String supplied=req.getHeader("Origin");
            if(!Set.of("GET","HEAD","OPTIONS").contains(req.getMethod())&&supplied!=null&&!origin.equals(supplied)){res.sendError(403);return;}
            if("POST".equals(req.getMethod())&&(req.getContextPath()+"/api/web/login").equals(req.getRequestURI())&&!allow(req.getRemoteAddr())){res.setHeader("Retry-After","60");res.sendError(429);return;}
            chain.doFilter(req,res);
        }
    }
}
