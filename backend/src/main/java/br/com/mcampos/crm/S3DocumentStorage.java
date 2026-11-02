package br.com.mcampos.crm;

import java.net.URI;
import java.time.Duration;
import java.io.IOException;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.checksums.*;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;

@Service @ConditionalOnProperty(name="app.storage-mode",havingValue="s3")
class S3DocumentStorage extends DocumentStorage {
    private final S3Client client;
    private final String bucket;
    @Autowired S3DocumentStorage(@Value("${app.storage-endpoint}") String endpoint,
        @Value("${app.storage-region}") String region,@Value("${app.storage-access-key}") String key,
        @Value("${app.storage-secret-key}") String secret,@Value("${app.storage-bucket}") String bucket) {
        this(build(endpoint,region,key,secret),bucket);
    }
    S3DocumentStorage(S3Client client,String bucket) {
        super("storage-unused");
        if(!bucket.matches("[a-z0-9][a-z0-9-]{1,61}[a-z0-9]"))throw new IllegalArgumentException("Bucket inválido.");
        this.client=client;this.bucket=bucket;
    }
    static S3Client build(String endpoint,String region,String key,String secret) {
        URI uri=URI.create(endpoint);
        if(!"https".equals(uri.getScheme())||uri.getHost()==null||!uri.getHost().matches("br-[a-z0-9-]+\\.storage\\.c-[0-9]+\\.[a-z0-9-]+\\.aws\\.neon\\.tech")
            ||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||uri.getPort()!=-1||!java.util.Set.of("","/").contains(uri.getPath()))
            throw new IllegalArgumentException("Use o endpoint HTTPS privado do Neon Storage.");
        if(key.isBlank()||secret.isBlank()||region.isBlank())throw new IllegalArgumentException("Configure as credenciais privadas do armazenamento.");
        return S3Client.builder().endpointOverride(uri).region(Region.of(region))
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(key,secret)))
            .httpClientBuilder(UrlConnectionHttpClient.builder().connectionTimeout(Duration.ofSeconds(10)).socketTimeout(Duration.ofSeconds(30)))
            .overrideConfiguration(c->c.apiCallTimeout(Duration.ofSeconds(60)).apiCallAttemptTimeout(Duration.ofSeconds(35)))
            .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
            .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build()).build();
    }
    @Override protected byte[] readBytes(String digest) {
        try(var response=client.getObject(GetObjectRequest.builder().bucket(bucket).key(digest).build())) {
            if(response.response().contentLength()!=null&&response.response().contentLength()>MAX_BYTES)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Documento maior que o permitido.");
            return response.readNBytes(MAX_BYTES+1);
        }catch(S3Exception e){throw storageError(e);}
        catch(IOException|software.amazon.awssdk.core.exception.SdkClientException e){throw unavailable();}
    }
    @Override protected void writeBytes(String digest,byte[] bytes,String mime) {
        try {
            try {
                client.headObject(HeadObjectRequest.builder().bucket(bucket).key(digest).build());
                read(digest); // Never replace a corrupt existing immutable object.
                return;
            }catch(S3Exception e){if(e.statusCode()!=404)throw e;}
            client.putObject(PutObjectRequest.builder().bucket(bucket).key(digest).contentType(mime)
                .cacheControl("private, no-store").metadata(java.util.Map.of("sha256",digest)).build(),RequestBody.fromBytes(bytes));
        }catch(S3Exception e){throw storageError(e);}
        catch(software.amazon.awssdk.core.exception.SdkClientException e){throw unavailable();}
    }
    private ResponseStatusException storageError(S3Exception e) {
        return e.statusCode()==404?new ResponseStatusException(HttpStatus.NOT_FOUND,"Documento não encontrado no armazenamento."):unavailable();
    }
    private ResponseStatusException unavailable(){return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Armazenamento indisponível. Tente novamente.");}
    @jakarta.annotation.PreDestroy public void close(){client.close();}
}
