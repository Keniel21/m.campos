package br.com.mcampos.crm;
import org.springframework.context.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
@Configuration
class PasswordConfig {
    @Bean BCryptPasswordEncoder passwords() { return new BCryptPasswordEncoder(); }
}
