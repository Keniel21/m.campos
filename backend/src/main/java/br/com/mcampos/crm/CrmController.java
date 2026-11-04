package br.com.mcampos.crm;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.*;

@RestController
@RequestMapping("/api/crm")
public class CrmController {
    private final CrmService service;
    public CrmController(CrmService service) { this.service = service; }
    @GetMapping("/{module}") public List<Map<String, Object>> list(@PathVariable String module) { return service.list(module); }
    @PostMapping("/{module}") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@PathVariable String module, @RequestBody Map<String, Object> body) { return service.save(module, null, body); }
    @PutMapping("/{module}/{id}") public Map<String, Object> update(@PathVariable String module, @PathVariable String id, @RequestBody Map<String, Object> body) { return service.save(module, id, body); }
    @PostMapping("/estoque/{id}/restore") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restore(@PathVariable String id) { service.restoreVehicle(id); }
    @DeleteMapping("/{module}/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String module, @PathVariable String id) { service.delete(module, id); }
}
