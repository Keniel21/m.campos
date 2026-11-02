package br.com.mcampos.crm;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
@Configuration
class StorageConfiguration {
    @Bean @ConditionalOnProperty(name="app.storage-mode",havingValue="local",matchIfMissing=true)
    DocumentStorage localDocuments(@Value("${app.document-directory:storage/documents}") String directory){return new DocumentStorage(directory);}
}
