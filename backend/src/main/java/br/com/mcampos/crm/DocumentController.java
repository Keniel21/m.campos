package br.com.mcampos.crm;

import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @Profile("desktop") @RequestMapping("/api/desktop/documents")
class DocumentController {
    private final DesktopService service;
    private final DocumentStorage storage;
    DocumentController(DesktopService service, DocumentStorage storage) { this.service=service; this.storage=storage; }
    @PostMapping("/{id}/local-copy") Object link(@PathVariable long id,@RequestBody Map<String,Object> body) { return service.linkLocalCopy(id,body); }
    @GetMapping("/{id}/content") ResponseEntity<byte[]> content(@PathVariable long id) {
        var doc=service.document(id);
        if (doc.get("storageHash") == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Documento ainda não copiado para este computador.");
        byte[] bytes=storage.read(doc.get("storageHash").toString());
        String name=Objects.toString(doc.get("fileName"),"documento");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(DocumentStorage.mediaType(bytes)))
            .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.inline().filename(name,StandardCharsets.UTF_8).build().toString())
            .header("X-Content-Type-Options","nosniff").cacheControl(CacheControl.noStore()).contentLength(bytes.length).body(bytes);
    }
}
