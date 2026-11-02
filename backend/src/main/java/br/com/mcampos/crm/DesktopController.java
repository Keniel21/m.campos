package br.com.mcampos.crm;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
@RestController @Profile({"desktop", "web"}) @RequestMapping("/api/desktop")
class DesktopController {
    private final DesktopService service;
    private final boolean web;
    DesktopController(DesktopService service, org.springframework.core.env.Environment environment) {
        this.service = service; this.web=environment.acceptsProfiles(org.springframework.core.env.Profiles.of("web"));
    }
    @GetMapping("/session") Map<String,Object> session(CsrfToken token, java.security.Principal principal) {
        return Map.of("header",token.getHeaderName(),"token",token.getToken(),"mode",web?"web":"desktop",
            "authenticated",!web||principal!=null,"userName",principal==null?"Operador":principal.getName());
    }
    @GetMapping("/crm/data") Map<String,Object> data() { return service.snapshot(); }
    @GetMapping("/crm/{module}") Object list(@PathVariable String module) { return service.list(module); }
    @PostMapping("/crm/{module}") Object create(@PathVariable String module, @RequestBody Map<String,Object> body) { return service.save(module,null,body); }
    @PutMapping("/crm/{module}/{id}") Object update(@PathVariable String module, @PathVariable long id, @RequestBody Map<String,Object> body) { return service.save(module,id,body); }
    @DeleteMapping("/crm/{module}/{id}") Object delete(@PathVariable String module, @PathVariable long id) { service.delete(module,id); return Map.of("success",true); }
    @GetMapping("/company-cnpjs") Object companies() { return service.list("company_cnpjs"); }
}
