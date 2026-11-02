package br.com.mcampos.crm;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.web.servlet.config.annotation.*;
@Configuration @Profile({"desktop", "web"})
class DesktopAssets implements WebMvcConfigurer {
    private final String location;
    DesktopAssets(@Value("${app.frontend-directory:.}") String directory) { location = Path.of(directory).toAbsolutePath().normalize().toUri().toString(); }
    @Override public void addViewControllers(ViewControllerRegistry registry) { registry.addViewController("/").setViewName("forward:/index.html"); }
    @Override public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/index.html", "/app.js", "/style.css", "/manifest.json", "/service-worker.js").addResourceLocations(location);
        registry.addResourceHandler("/src/**").addResourceLocations(location + "src/");
    }
}
