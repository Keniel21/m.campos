package br.com.mcampos.crm;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("web")
class WebHealth {
    @GetMapping("/healthz") java.util.Map<String,String> health(){return java.util.Map.of("status","up");}
}
