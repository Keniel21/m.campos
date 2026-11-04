package br.com.mcampos.crm;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import org.springframework.web.server.ResponseStatusException;
import java.io.ByteArrayInputStream;

class S3DocumentStorageTest {
    byte[] pdf="%PDF-1.4\n%%EOF\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    void returns(S3Client client,byte[] bytes){when(client.getObject(any(GetObjectRequest.class))).thenAnswer(invocation->new ResponseInputStream<>(GetObjectResponse.builder().contentLength((long)bytes.length).build(),AbortableInputStream.create(new ByteArrayInputStream(bytes))));}
    @Test void uploadsAndReadsVerifiedBytesWithoutLocalFiles() {
        var client=mock(S3Client.class);var storage=new S3DocumentStorage(client,"documentos");returns(client,pdf);
        when(client.headObject(any(HeadObjectRequest.class))).thenThrow(NoSuchKeyException.builder().statusCode(404).build());
        var saved=storage.saveDataUrl("data:application/pdf;base64,"+java.util.Base64.getEncoder().encodeToString(pdf));
        assertEquals(DocumentStorage.hash(pdf),saved.sha256());assertEquals(pdf.length,saved.size());assertArrayEquals(pdf,storage.read(saved.sha256()));
        verify(client).putObject(argThat((PutObjectRequest r)->r.bucket().equals("documentos")&&r.key().equals(saved.sha256())&&r.contentType().equals("application/pdf")),any(RequestBody.class));
    }
    @Test void corruptExistingObjectIsNeverReplacedAndKeysCannotTraverse() {
        var client=mock(S3Client.class);var storage=new S3DocumentStorage(client,"documentos");
        assertThrows(ResponseStatusException.class,()->storage.read("../secret"));verifyNoInteractions(client);
        returns(client,"%PDF-wrong".getBytes());
        var error=assertThrows(ResponseStatusException.class,()->storage.saveDataUrl("data:application/pdf;base64,"+java.util.Base64.getEncoder().encodeToString(pdf)));
        assertEquals(409,error.getStatusCode().value());verify(client,never()).putObject(any(PutObjectRequest.class),any(RequestBody.class));
    }
    @Test void inaccessibleOrOversizedObjectsDoNotLeakProviderDetails() {
        var client=mock(S3Client.class);var storage=new S3DocumentStorage(client,"documentos");
        when(client.getObject(any(GetObjectRequest.class))).thenThrow(S3Exception.builder().statusCode(403).message("private provider detail").build());
        var denied=assertThrows(ResponseStatusException.class,()->storage.read(DocumentStorage.hash(pdf)));assertEquals(503,denied.getStatusCode().value());assertFalse(denied.getReason().contains("provider"));
        when(client.getObject(any(GetObjectRequest.class))).thenReturn(new ResponseInputStream<>(GetObjectResponse.builder().contentLength((long)DocumentStorage.MAX_BYTES+1).build(),AbortableInputStream.create(new ByteArrayInputStream(new byte[0]))));
        assertEquals(409,assertThrows(ResponseStatusException.class,()->storage.read(DocumentStorage.hash(pdf))).getStatusCode().value());
    }
    @Test void credentialsCannotBeSentToNonNeonOrNonTlsEndpoints() {
        for(String endpoint:java.util.List.of("http://example.com","https://attacker.example","https://user:pass@br-example.storage.c-13.us-east-1.aws.neon.tech"))
            assertThrows(IllegalArgumentException.class,()->S3DocumentStorage.build(endpoint,"us-east-1","dummy","dummy"));
    }
}
