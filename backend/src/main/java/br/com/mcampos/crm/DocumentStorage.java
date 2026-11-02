package br.com.mcampos.crm;

import java.io.IOException;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

public class DocumentStorage {
    static final int MAX_BYTES = 20 * 1024 * 1024;
    private final Path root;
    public record StoredFile(String sha256, long size, String mediaType) {}
    public DocumentStorage(@Value("${app.document-directory:storage/documents}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }
    Path path(String digest) {
        if (digest == null || !digest.matches("[a-f0-9]{64}")) throw CrmService.bad("Identificador de arquivo inválido.");
        Path target = root.resolve(digest).normalize();
        if (!target.startsWith(root)) throw CrmService.bad("Caminho de arquivo inválido.");
        return target;
    }
    static String hash(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    static String mediaType(byte[] bytes) {
        if (bytes.length >= 5 && new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) return "application/pdf";
        if (bytes.length >= 3 && bytes[0] == (byte)255 && bytes[1] == (byte)216 && bytes[2] == (byte)255) return "image/jpeg";
        throw CrmService.bad("Anexe um PDF ou imagem JPEG válido.");
    }
    public byte[] read(String digest) {
        path(digest); // Validate the key before either local or remote access.
        byte[] bytes=readBytes(digest);
        if(bytes.length==0||bytes.length>MAX_BYTES)throw new ResponseStatusException(HttpStatus.CONFLICT,"Tamanho do documento inválido.");
        if(!hash(bytes).equals(digest))throw new ResponseStatusException(HttpStatus.CONFLICT,"A integridade do documento não confere.");
        mediaType(bytes);
        return bytes;
    }
    protected byte[] readBytes(String digest) {
        try {
            Path file = path(digest);
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS) || Files.size(file) > MAX_BYTES)
                throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Arquivo local indisponível. Confira o backup dos documentos.");
            byte[] bytes = Files.readAllBytes(file);
            return bytes;
        } catch (IOException e) { throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Arquivo local indisponível."); }
    }
    public StoredFile inspect(String digest) {
        byte[] bytes = read(digest);
        return new StoredFile(digest,bytes.length,mediaType(bytes));
    }
    public StoredFile saveDataUrl(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        if (comma < 0 || comma > 100 || !dataUrl.substring(0,comma).matches("data:(application/pdf|image/jpeg);base64")
                || dataUrl.length() > ((MAX_BYTES + 2L) / 3) * 4 + 100) throw CrmService.bad("Arquivo inválido ou maior que 20 MB.");
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(dataUrl.substring(comma+1)); }
        catch (IllegalArgumentException e) { throw CrmService.bad("Conteúdo de arquivo inválido."); }
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw CrmService.bad("Arquivo vazio ou maior que 20 MB.");
        String mime = mediaType(bytes);
        if (!dataUrl.startsWith("data:"+mime+";base64,")) throw CrmService.bad("O tipo informado não corresponde ao conteúdo do arquivo.");
        String digest = hash(bytes);
        writeBytes(digest,bytes,mime);
        return inspect(digest);
    }
    protected void writeBytes(String digest,byte[] bytes,String mime) {
        try {
            Files.createDirectories(root);
            Path destination = path(digest);
            if (!Files.exists(destination)) {
                Path temporary = Files.createTempFile(root,"upload-",".part");
                try {
                    Files.write(temporary,bytes);
                    try { Files.move(temporary,destination,StandardCopyOption.ATOMIC_MOVE); }
                    catch (AtomicMoveNotSupportedException e) { Files.move(temporary,destination); }
                    catch (FileAlreadyExistsException ignored) {}
                } finally { Files.deleteIfExists(temporary); }
            }
        } catch (IOException e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Não foi possível gravar o documento local. Confira o disco."); }
    }
}
