package org.move.api;

import static org.move.api.Models.*;

import jakarta.validation.Valid;
import java.io.IOException;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ApplicationController {
  private final ApplicationService service;

  public ApplicationController(ApplicationService service) {
    this.service = service;
  }

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @GetMapping("/me")
  public UserView me(Authentication auth) {
    return new UserView(auth.getName(), service.isReviewer(auth) ? "REVIEWER" : "APPLICANT");
  }

  @GetMapping("/requirements")
  public Map<String, Object> requirements() {
    // CHANGE: have the business owner approve this copy before public use.
    return Map.of(
        "intro",
        "Report employment, community service, education, or job training. Staff will review your"
            + " information and supporting documents.",
        "categories",
        List.of("Employment", "Community Engagement", "Education", "Covered Reasons"),
        "coveredReasons",
        "Some people may be exempt from community engagement requirements. Review current official"
            + " guidance and describe your situation on the application so staff can review it.",
        "guidanceUrl",
        "https://www.medicaid.gov/renew-info");
  }

  @GetMapping("/applications")
  public List<ApplicationView> list(Authentication auth) {
    return service.list(auth);
  }

  @GetMapping("/applications/{id}")
  public ApplicationView get(@PathVariable UUID id, Authentication auth) {
    return service.get(id, auth);
  }

  @PostMapping("/applications")
  @ResponseStatus(HttpStatus.CREATED)
  public ApplicationView create(@Valid @RequestBody ApplicationInput input, Authentication auth) {
    return service.create(input, auth);
  }

  @PutMapping("/applications/{id}")
  public ApplicationView update(
      @PathVariable UUID id,
      @RequestParam long version,
      @Valid @RequestBody ApplicationInput input,
      Authentication auth) {
    return service.update(id, version, input, auth);
  }

  @PostMapping("/applications/{id}/submit")
  public ApplicationView submit(
      @PathVariable UUID id, @RequestParam long version, Authentication auth) {
    return service.submit(id, version, auth);
  }

  @PostMapping("/applications/{id}/decision")
  public ApplicationView decide(
      @PathVariable UUID id,
      @RequestParam long version,
      @Valid @RequestBody DecisionInput input,
      Authentication auth) {
    return service.decide(id, version, input, auth);
  }

  @GetMapping("/applications/{id}/history")
  public List<DecisionEvent> history(@PathVariable UUID id, Authentication auth) {
    return service.history(id, auth);
  }

  @PostMapping(
      value = "/applications/{id}/documents",
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApplicationView upload(
      @PathVariable UUID id,
      @RequestPart MultipartFile file,
      @RequestParam DocumentType documentType,
      @RequestParam LocalDate documentDate,
      Authentication auth)
      throws IOException {
    return service.upload(id, file, documentType, documentDate, auth);
  }

  @DeleteMapping("/applications/{id}/documents/{documentId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id, @PathVariable UUID documentId, Authentication auth) {
    service.delete(id, documentId, auth);
  }

  @GetMapping("/applications/{id}/documents/{documentId}")
  public ResponseEntity<byte[]> download(
      @PathVariable UUID id, @PathVariable UUID documentId, Authentication auth) {
    var doc = service.document(id, documentId, auth);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(doc.contentType))
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(doc.filename).build().toString())
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .body(service.contents(doc));
  }
}
