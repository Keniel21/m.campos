package br.com.mcampos.crm;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration @Profile("desktop")
class DesktopSecurity {
    @Bean SecurityFilterChain desktopFilterChain(HttpSecurity http) throws Exception {
        return http.headers(h -> h.frameOptions(f -> f.sameOrigin()))
            .authorizeHttpRequests(a -> a.requestMatchers("/api/desktop/**").permitAll()
                .requestMatchers("/api/**").denyAll().anyRequest().permitAll())
            .addFilterBefore(new OncePerRequestFilter() {
                @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                        throws ServletException, IOException {
                    boolean allowed = Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(request.getServerName());
                    String origin = request.getHeader("Origin");
                    if (origin != null) {
                        try {
                            URI uri = URI.create(origin);
                            int port = uri.getPort() < 0 ? ("https".equals(uri.getScheme()) ? 443 : 80) : uri.getPort();
                            allowed &= uri.getHost().equals(request.getServerName()) && port == request.getServerPort()
                                && uri.getScheme().equals(request.getScheme());
                        } catch (Exception e) { allowed = false; }
                    }
                    if (!allowed) { response.sendError(403); return; }
                    response.setHeader("Cache-Control", "no-store");
                    chain.doFilter(request, response);
                }
            }, CsrfFilter.class).build();
    }
}
