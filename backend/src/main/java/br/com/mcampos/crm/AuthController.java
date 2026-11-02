package br.com.mcampos.crm;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

@RestController @RequestMapping("/api/auth")
@org.springframework.context.annotation.Profile("!desktop")
public class AuthController {
    private final UserRepository users;
    private final BCryptPasswordEncoder passwords;
    private final JwtEncoder encoder;
    private final String dummyHash;
    public AuthController(UserRepository users, BCryptPasswordEncoder passwords, JwtEncoder encoder) {
        this.users = users; this.passwords = passwords; this.encoder = encoder;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }
    public record Login(@NotBlank @Email String email, @NotBlank @Size(max = 72) String password) {}
    @PostMapping("/login") public Map<String, Object> login(@Valid @RequestBody Login request) {
        var user = users.findByEmail(request.email().trim().toLowerCase(Locale.ROOT));
        boolean valid = passwords.matches(request.password(), user.map(u -> u.passwordHash).orElse(dummyHash));
        if (!valid || user.isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer("mcampos-crm").subject(user.get().email).issuedAt(now).expiresAt(now.plusSeconds(3600)).build();
        var token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return Map.of("token", token, "expiresIn", 3600);
    }
}
