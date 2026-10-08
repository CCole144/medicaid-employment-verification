# Complete MOVE source code

Each heading is the exact path relative to your repository root. Create that file and paste its code. All files below are also provided individually in the archive. Keep the included Maven wrapper scripts and `.mvn/wrapper` directory together. See README.md for installation and integration instructions.

## .env.example

```
# Run npm run setup at the repository root to generate working local values.
# CHANGE: these are local project accounts, not state Medicaid accounts.
MOVE_APPLICANT_USER=applicant
MOVE_APPLICANT_PASSWORD=CHANGE_TO_A_PASSWORD_AT_LEAST_12_CHARACTERS
MOVE_REVIEWER_USER=reviewer
MOVE_REVIEWER_PASSWORD=CHANGE_TO_A_DIFFERENT_PASSWORD_AT_LEAST_12_CHARACTERS
MOVE_DB_PASSWORD=CHANGE_TO_A_RANDOM_PASSWORD
MOVE_ENCRYPTION_KEY=CHANGE_TO_A_BASE64_ENCODED_32_BYTE_KEY
```

## .github/workflows/ci.yml

```yaml
name: MOVE tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: "17", cache: maven }
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npm run setup
      - run: npm run test:ui
      - run: npm run test:api
      - run: npm run build:ui
      - run: npx playwright install --with-deps chromium
        working-directory: ui
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: test-failures, path: "ui/test-results/" }
```

## .gitignore

```
node_modules/
ui/dist/
ui/coverage/
ui/test-results/
ui/playwright-report/
api/target/
api/data/
.env
*.log
```

## api/.mvn/wrapper/maven-wrapper.properties

```properties
wrapperVersion=3.3.4
distributionType=only-script
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip
```

## api/pom.xml

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.5.6</version><relativePath/></parent>
  <groupId>org.move</groupId><artifactId>api</artifactId><version>1.0.0</version>
  <properties><java.version>17</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
    <dependency><groupId>com.h2database</groupId><artifactId>h2</artifactId><scope>runtime</scope></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-test</artifactId><scope>test</scope></dependency>
  </dependencies>
  <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin><plugin><groupId>org.jacoco</groupId><artifactId>jacoco-maven-plugin</artifactId><version>0.8.13</version><executions><execution><goals><goal>prepare-agent</goal></goals></execution><execution><id>report</id><phase>test</phase><goals><goal>report</goal></goals></execution></executions></plugin></plugins></build>
</project>
```

## api/src/main/java/org/move/api/ApiErrors.java

```java
package org.move.api;

import java.util.*;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> application(ResponseStatusException ex) {
    return ResponseEntity.status(ex.getStatusCode())
        .body(Map.of("message", Objects.requireNonNullElse(ex.getReason(), "Request failed.")));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
    Map<String, String> fields = new LinkedHashMap<>();
    ex.getBindingResult()
        .getFieldErrors()
        .forEach(
            e ->
                fields.put(
                    e.getField(),
                    Objects.requireNonNullElse(e.getDefaultMessage(), "Invalid value")));
    return ResponseEntity.badRequest()
        .body(Map.of("message", "Check the highlighted information.", "fields", fields));
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    MissingServletRequestParameterException.class,
    MissingServletRequestPartException.class
  })
  ResponseEntity<?> malformed(Exception ex) {
    return ResponseEntity.badRequest()
        .body(Map.of("message", "Required information is missing or invalid."));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<?> oversized(Exception ex) {
    return ResponseEntity.status(413).body(Map.of("message", "Select a file of 10 MB or less."));
  }

  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  ResponseEntity<?> conflict(Exception ex) {
    return ResponseEntity.status(409)
        .body(Map.of("message", "This application changed. Reload before trying again."));
  }
}
```

## api/src/main/java/org/move/api/ApplicationController.java

```java
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
```

## api/src/main/java/org/move/api/ApplicationEntity.java

```java
package org.move.api;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "applications")
public class ApplicationEntity {
  @Id UUID id;
  @Version long version;

  @Column(nullable = false)
  String owner;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  Models.Status status;

  @Lob
  @Column(nullable = false)
  String encryptedPayload;

  @Column(length = 2000)
  String reviewNote;

  Instant createdAt;
  Instant updatedAt;

  protected ApplicationEntity() {}
}
```

## api/src/main/java/org/move/api/ApplicationRepository.java

```java
package org.move.api;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ApplicationRepository extends JpaRepository<ApplicationEntity, UUID> {
  List<ApplicationEntity> findByOwnerOrderByUpdatedAtDesc(String owner);

  List<ApplicationEntity> findByStatusNotOrderByUpdatedAtDesc(Models.Status status);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select a from ApplicationEntity a where a.id = :id")
  Optional<ApplicationEntity> findForUpdate(UUID id);
}
```

## api/src/main/java/org/move/api/ApplicationService.java

```java
package org.move.api;

import static org.move.api.Models.*;
import static org.springframework.http.HttpStatus.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class ApplicationService {
  private final ApplicationRepository applications;
  private final DocumentRepository documents;
  private final ReviewRepository reviews;
  private final Crypto crypto;
  private final ObjectMapper mapper;
  private final FilePolicy files;

  public ApplicationService(
      ApplicationRepository applications,
      DocumentRepository documents,
      ReviewRepository reviews,
      Crypto crypto,
      ObjectMapper mapper,
      FilePolicy files) {
    this.applications = applications;
    this.documents = documents;
    this.reviews = reviews;
    this.crypto = crypto;
    this.mapper = mapper;
    this.files = files;
  }

  boolean isReviewer(Authentication auth) {
    return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_REVIEWER"));
  }

  private ApplicationEntity accessible(UUID id, Authentication auth, boolean lock) {
    ApplicationEntity entity =
        (lock ? applications.findForUpdate(id) : applications.findById(id))
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Application not found."));
    if (!entity.owner.equals(auth.getName()) && !isReviewer(auth))
      throw new ResponseStatusException(NOT_FOUND, "Application not found.");
    if (isReviewer(auth) && entity.status == Status.DRAFT)
      throw new ResponseStatusException(NOT_FOUND, "Application not found.");
    return entity;
  }

  private void editable(ApplicationEntity entity, Authentication auth) {
    if (isReviewer(auth) || !entity.owner.equals(auth.getName()))
      throw new ResponseStatusException(FORBIDDEN, "Only the applicant can edit this application.");
    if (entity.status != Status.DRAFT && entity.status != Status.RETURNED)
      throw new ResponseStatusException(
          CONFLICT, "This application is locked while staff reviews it.");
  }

  private ApplicationInput read(ApplicationEntity entity) {
    try {
      return mapper.readValue(crypto.decryptText(entity.encryptedPayload), ApplicationInput.class);
    } catch (Exception e) {
      throw new IllegalStateException("Could not read saved application.", e);
    }
  }

  private void write(ApplicationEntity entity, ApplicationInput input) {
    try {
      entity.encryptedPayload = crypto.encryptText(mapper.writeValueAsString(input));
    } catch (Exception e) {
      throw new IllegalStateException("Could not save application.", e);
    }
  }

  private ApplicationInput checked(ApplicationInput input, String existingSsn) {
    String ssn = input.ssn();
    if (ssn == null || ssn.isBlank()) ssn = existingSsn;
    if (ssn == null || !ssn.matches("[0-9]{3}-[0-9]{2}-[0-9]{4}"))
      throw new ResponseStatusException(BAD_REQUEST, "SSN must use XXX-XX-XXXX format.");
    if (YearMonth.parse(input.reportingMonth()).isAfter(YearMonth.now()))
      throw new ResponseStatusException(BAD_REQUEST, "Reporting month cannot be in the future.");
    if (input.engagements().isEmpty()
        && (input.coveredReason() == null || input.coveredReason().isBlank()))
      throw new ResponseStatusException(
          BAD_REQUEST, "Report at least one activity or explain a covered reason.");
    for (var entry : input.engagements())
      if (entry.type() == EngagementType.EDUCATION
          && (entry.attendance() == null || entry.program() == null || entry.program().isBlank()))
        throw new ResponseStatusException(
            BAD_REQUEST, "Education requires a program and attendance level.");
    return new ApplicationInput(
        input.lastName().trim(),
        input.middleInitial(),
        input.firstName().trim(),
        input.dob(),
        ssn,
        input.monthlyIncome(),
        input.engagements(),
        input.reportingMonth(),
        input.coveredReason());
  }

  public ApplicationView create(ApplicationInput input, Authentication auth) {
    if (isReviewer(auth))
      throw new ResponseStatusException(FORBIDDEN, "Applicants create applications.");
    ApplicationEntity entity = new ApplicationEntity();
    entity.id = UUID.randomUUID();
    entity.owner = auth.getName();
    entity.status = Status.DRAFT;
    entity.createdAt = Instant.now();
    entity.updatedAt = entity.createdAt;
    write(entity, checked(input, null));
    applications.saveAndFlush(entity);
    return view(entity);
  }

  public ApplicationView update(
      UUID id, long version, ApplicationInput input, Authentication auth) {
    var entity = accessible(id, auth, true);
    editable(entity, auth);
    version(entity, version);
    write(entity, checked(input, read(entity).ssn()));
    entity.updatedAt = Instant.now();
    applications.flush();
    return view(entity);
  }

  private void version(ApplicationEntity entity, long supplied) {
    if (entity.version != supplied)
      throw new ResponseStatusException(
          CONFLICT, "This application changed. Reload it before trying again.");
  }

  public ApplicationView get(UUID id, Authentication auth) {
    return view(accessible(id, auth, false));
  }

  public List<ApplicationView> list(Authentication auth) {
    var entries =
        isReviewer(auth)
            ? applications.findByStatusNotOrderByUpdatedAtDesc(Status.DRAFT)
            : applications.findByOwnerOrderByUpdatedAtDesc(auth.getName());
    return entries.stream().map(this::view).toList();
  }

  public ApplicationView submit(UUID id, long version, Authentication auth) {
    var entity = accessible(id, auth, true);
    editable(entity, auth);
    version(entity, version);
    if (documents.countByApplicationId(id) == 0)
      throw new ResponseStatusException(
          BAD_REQUEST, "Upload at least one supporting document before submitting.");
    entity.status = Status.SUBMITTED;
    entity.reviewNote = null;
    entity.updatedAt = Instant.now();
    applications.flush();
    return view(entity);
  }

  public ApplicationView decide(
      UUID id, long version, DecisionInput decision, Authentication auth) {
    if (!isReviewer(auth))
      throw new ResponseStatusException(FORBIDDEN, "Only staff can record review decisions.");
    var entity = accessible(id, auth, true);
    version(entity, version);
    if (entity.status != Status.SUBMITTED && entity.status != Status.FURTHER_REVIEW)
      throw new ResponseStatusException(CONFLICT, "This application is not awaiting review.");
    if (decision.decision() != Decision.APPROVE
        && (decision.note() == null || decision.note().isBlank()))
      throw new ResponseStatusException(
          BAD_REQUEST, "Explain the correction or further review needed.");
    entity.status =
        switch (decision.decision()) {
          case APPROVE -> Status.APPROVED;
          case FURTHER_REVIEW -> Status.FURTHER_REVIEW;
          case RETURN -> Status.RETURNED;
        };
    entity.reviewNote = decision.note();
    entity.updatedAt = Instant.now();
    var event = new ReviewEntity();
    event.id = UUID.randomUUID();
    event.applicationId = id;
    event.decision = decision.decision();
    event.note = decision.note();
    event.reviewer = auth.getName();
    event.at = entity.updatedAt;
    reviews.save(event);
    applications.flush();
    return view(entity);
  }

  public List<DecisionEvent> history(UUID id, Authentication auth) {
    accessible(id, auth, false);
    return reviews.findByApplicationIdOrderByAtAsc(id).stream()
        .map(e -> new DecisionEvent(e.id, e.decision, e.note, e.reviewer, e.at))
        .toList();
  }

  public ApplicationView upload(
      UUID id, MultipartFile file, DocumentType type, LocalDate date, Authentication auth)
      throws IOException {
    var entity = accessible(id, auth, true);
    editable(entity, auth);
    if (date == null || date.isAfter(LocalDate.now()))
      throw new ResponseStatusException(BAD_REQUEST, "Document date cannot be in the future.");
    if (documents.countByApplicationId(id) >= 20)
      throw new ResponseStatusException(BAD_REQUEST, "Maximum 20 documents per application.");
    byte[] bytes = file.getBytes();
    String filename = files.safeName(file.getOriginalFilename());
    String mime = files.validate(filename, bytes);
    var doc = new DocumentEntity();
    doc.id = UUID.randomUUID();
    doc.applicationId = id;
    doc.filename = filename;
    doc.contentType = mime;
    doc.documentType = type;
    doc.documentDate = date;
    doc.uploadedAt = Instant.now();
    doc.originalSize = bytes.length;
    doc.encryptedBytes = crypto.encrypt(bytes);
    documents.saveAndFlush(doc);
    entity.updatedAt = Instant.now();
    applications.flush();
    return view(entity);
  }

  public void delete(UUID id, UUID documentId, Authentication auth) {
    var entity = accessible(id, auth, true);
    editable(entity, auth);
    var doc = document(id, documentId, auth);
    documents.delete(doc);
    entity.updatedAt = Instant.now();
    applications.flush();
  }

  public DocumentEntity document(UUID id, UUID documentId, Authentication auth) {
    accessible(id, auth, false);
    return documents
        .findById(documentId)
        .filter(doc -> doc.applicationId.equals(id))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Document not found."));
  }

  public byte[] contents(DocumentEntity document) {
    return crypto.decrypt(document.encryptedBytes);
  }

  private ApplicationView view(ApplicationEntity entity) {
    var input = read(entity);
    var docs =
        documents.findByApplicationIdOrderByUploadedAtAsc(entity.id).stream()
            .map(
                d ->
                    new DocumentView(
                        d.id,
                        d.filename,
                        d.documentType,
                        d.documentDate,
                        d.uploadedAt,
                        entity.status == Status.DRAFT ? "Received" : entity.status.name(),
                        d.originalSize))
            .toList();
    BigDecimal hours =
        input.engagements().stream()
            .map(Engagement::hours)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return new ApplicationView(
        entity.id,
        entity.version,
        entity.status,
        input.lastName(),
        input.middleInitial(),
        input.firstName(),
        input.dob(),
        "***-**-" + input.ssn().substring(input.ssn().length() - 4),
        input.monthlyIncome(),
        input.engagements(),
        hours,
        input.reportingMonth(),
        input.coveredReason(),
        entity.reviewNote,
        docs,
        entity.createdAt,
        entity.updatedAt);
  }
}
```

## api/src/main/java/org/move/api/Crypto.java

```java
package org.move.api;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class Crypto {
  private final SecretKeySpec key;
  private final SecureRandom random = new SecureRandom();

  public Crypto(@Value("${move.encryption-key}") String encodedKey) {
    byte[] bytes = Base64.getDecoder().decode(encodedKey);
    if (bytes.length != 32)
      throw new IllegalArgumentException("MOVE_ENCRYPTION_KEY must be a Base64 32-byte key.");
    key = new SecretKeySpec(bytes, "AES");
  }

  public byte[] encrypt(byte[] bytes) {
    try {
      byte[] iv = new byte[12];
      random.nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
      byte[] encrypted = cipher.doFinal(bytes);
      return ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array();
    } catch (Exception e) {
      throw new IllegalStateException("Encryption failed.", e);
    }
  }

  public byte[] decrypt(byte[] bytes) {
    try {
      ByteBuffer buffer = ByteBuffer.wrap(bytes);
      byte[] iv = new byte[12];
      buffer.get(iv);
      byte[] encrypted = new byte[buffer.remaining()];
      buffer.get(encrypted);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
      return cipher.doFinal(encrypted);
    } catch (Exception e) {
      throw new IllegalStateException("Decryption failed; check the encryption key.", e);
    }
  }

  public String encryptText(String text) {
    return Base64.getEncoder().encodeToString(encrypt(text.getBytes(StandardCharsets.UTF_8)));
  }

  public String decryptText(String text) {
    return new String(decrypt(Base64.getDecoder().decode(text)), StandardCharsets.UTF_8);
  }
}
```

## api/src/main/java/org/move/api/DocumentEntity.java

```java
package org.move.api;

import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

@Entity
@Table(name = "documents")
public class DocumentEntity {
  @Id UUID id;

  @Column(nullable = false)
  UUID applicationId;

  @Column(nullable = false, length = 180)
  String filename;

  String contentType;

  @Enumerated(EnumType.STRING)
  Models.DocumentType documentType;

  LocalDate documentDate;
  Instant uploadedAt;
  long originalSize;

  @Lob
  @Column(nullable = false)
  byte[] encryptedBytes;

  protected DocumentEntity() {}
}
```

## api/src/main/java/org/move/api/DocumentRepository.java

```java
package org.move.api;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {
  List<DocumentEntity> findByApplicationIdOrderByUploadedAtAsc(UUID id);

  long countByApplicationId(UUID id);
}
```

## api/src/main/java/org/move/api/FilePolicy.java

```java
package org.move.api;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class FilePolicy {
  public static final int MAX_BYTES = 10 * 1024 * 1024;

  public String validate(String name, byte[] data) {
    if (data.length == 0 || data.length > MAX_BYTES)
      fail("Select a nonempty file of 10 MB or less.");
    String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    boolean valid = false;
    String mime = "application/octet-stream";
    switch (ext) {
      case "pdf" -> {
        valid = starts(data, "%PDF-".getBytes(StandardCharsets.US_ASCII));
        mime = "application/pdf";
      }
      case "png" -> {
        valid = starts(data, new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10});
        mime = "image/png";
      }
      case "jpg", "jpeg" -> {
        valid = starts(data, new byte[] {(byte) 255, (byte) 216, (byte) 255});
        mime = "image/jpeg";
      }
      case "doc" -> {
        valid =
            starts(
                data,
                new byte[] {
                  (byte) 208, (byte) 207, 17, (byte) 224, (byte) 161, (byte) 177, 26, (byte) 225
                });
        mime = "application/msword";
      }
      case "docx" -> {
        valid = validDocx(data);
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
    }
    if (!valid) fail("File contents must match PDF, JPG, PNG, DOC, or DOCX format.");
    return mime;
  }

  private boolean validDocx(byte[] data) {
    boolean content = false, document = false;
    long expanded = 0;
    int count = 0;
    try (var zip = new ZipInputStream(new ByteArrayInputStream(data))) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        if (++count > 1000) return false;
        content |= entry.getName().equals("[Content_Types].xml");
        document |= entry.getName().equals("word/document.xml");
        byte[] buffer = new byte[8192];
        int read;
        while ((read = zip.read(buffer)) != -1) {
          expanded += read;
          if (expanded > 40L * 1024 * 1024) return false;
        }
      }
      return content && document;
    } catch (IOException e) {
      return false;
    }
  }

  private boolean starts(byte[] data, byte[] prefix) {
    return data.length >= prefix.length
        && Arrays.equals(Arrays.copyOf(data, prefix.length), prefix);
  }

  public String safeName(String name) {
    if (name == null) return "document";
    String safe = name.replace('\\', '/');
    safe = safe.substring(safe.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_");
    return safe.length() > 180 ? safe.substring(safe.length() - 180) : safe;
  }

  private void fail(String message) {
    throw new ResponseStatusException(BAD_REQUEST, message);
  }
}
```

## api/src/main/java/org/move/api/Models.java

```java
package org.move.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class Models {
  private Models() {}

  public enum EngagementType {
    EMPLOYMENT,
    VOLUNTEERING,
    EDUCATION,
    JOB_TRAINING
  }

  public enum Attendance {
    FULL_TIME,
    HALF_TIME,
    LESS_THAN_HALF_TIME
  }

  public enum Status {
    DRAFT,
    SUBMITTED,
    FURTHER_REVIEW,
    RETURNED,
    APPROVED
  }

  public enum Decision {
    APPROVE,
    FURTHER_REVIEW,
    RETURN
  }

  public enum DocumentType {
    PAY_STUB,
    EMPLOYER_LETTER,
    SCHOOL_RECORD,
    VOLUNTEER_RECORD,
    TRAINING_RECORD,
    OTHER
  }

  public record Engagement(
      @NotNull EngagementType type,
      @NotBlank @Size(max = 160) String name,
      @NotBlank @Size(max = 60) String organizationId,
      @NotNull @DecimalMin("0") @DecimalMax("744") BigDecimal hours,
      @Size(max = 160) String program,
      Attendance attendance) {}

  public record ApplicationInput(
      @NotBlank @Size(max = 80) String lastName,
      @Pattern(regexp = "[A-Za-z]?") String middleInitial,
      @NotBlank @Size(max = 80) String firstName,
      @NotNull @Past LocalDate dob,
      // Blank on updates preserves the encrypted SSN; it is never returned by the API.
      @Pattern(regexp = "(?:[0-9]{3}-[0-9]{2}-[0-9]{4})?") String ssn,
      @NotNull @DecimalMin("0") @DecimalMax("10000000") BigDecimal monthlyIncome,
      @NotNull @Size(max = 20) List<@Valid Engagement> engagements,
      @NotBlank @Pattern(regexp = "[0-9]{4}-(0[1-9]|1[0-2])") String reportingMonth,
      @Size(max = 2000) String coveredReason) {}

  public record DecisionInput(@NotNull Decision decision, @Size(max = 2000) String note) {}

  public record DocumentView(
      UUID id,
      String filename,
      DocumentType documentType,
      LocalDate documentDate,
      Instant uploadedAt,
      String status,
      long size) {}

  public record ApplicationView(
      UUID id,
      long version,
      Status status,
      String lastName,
      String middleInitial,
      String firstName,
      LocalDate dob,
      String ssnMasked,
      BigDecimal monthlyIncome,
      List<Engagement> engagements,
      BigDecimal totalHours,
      String reportingMonth,
      String coveredReason,
      String reviewNote,
      List<DocumentView> documents,
      Instant createdAt,
      Instant updatedAt) {}

  public record DecisionEvent(
      UUID id, Decision decision, String note, String reviewer, Instant at) {}

  public record UserView(String username, String role) {}
}
```

## api/src/main/java/org/move/api/MoveApplication.java

```java
package org.move.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MoveApplication {
  public static void main(String[] args) {
    SpringApplication.run(MoveApplication.class, args);
  }
}
```

## api/src/main/java/org/move/api/ReviewEntity.java

```java
package org.move.api;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "review_events")
public class ReviewEntity {
  @Id UUID id;
  UUID applicationId;

  @Enumerated(EnumType.STRING)
  Models.Decision decision;

  @Column(length = 2000)
  String note;

  String reviewer;
  Instant at;

  protected ReviewEntity() {}
}
```

## api/src/main/java/org/move/api/ReviewRepository.java

```java
package org.move.api;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<ReviewEntity, UUID> {
  List<ReviewEntity> findByApplicationIdOrderByAtAsc(UUID id);
}
```

## api/src/main/java/org/move/api/SecurityConfig.java

```java
package org.move.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  // CHANGE: replace these two local project accounts with your team's identity provider.
  @Bean
  UserDetailsService users(
      @Value("${move.applicant-user}") String applicant,
      @Value("${move.applicant-password}") String applicantPassword,
      @Value("${move.reviewer-user}") String reviewer,
      @Value("${move.reviewer-password}") String reviewerPassword) {
    if (applicant.equals(reviewer)
        || applicantPassword.length() < 12
        || reviewerPassword.length() < 12)
      throw new IllegalArgumentException(
          "Use different usernames and passwords with at least 12 characters.");
    var encoder = new BCryptPasswordEncoder();
    return new InMemoryUserDetailsManager(
        User.withUsername(applicant)
            .password("{bcrypt}" + encoder.encode(applicantPassword))
            .roles("APPLICANT")
            .build(),
        User.withUsername(reviewer)
            .password("{bcrypt}" + encoder.encode(reviewerPassword))
            .roles("REVIEWER")
            .build());
  }

  @Bean
  SecurityFilterChain security(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/api/csrf", "/api/requirements", "/api/login")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .requestCache(cache -> cache.disable())
        .formLogin(
            form ->
                form.loginProcessingUrl("/api/login")
                    .successHandler(
                        (req, res, auth) -> {
                          res.setStatus(204);
                        })
                    .failureHandler(
                        (req, res, e) -> {
                          res.setStatus(401);
                          res.setContentType("application/json");
                          res.getWriter().write("{\"message\":\"Invalid username or password.\"}");
                        }))
        .logout(
            logout ->
                logout
                    .logoutUrl("/api/logout")
                    .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(
                        (req, res, e) -> {
                          res.setStatus(401);
                          res.setContentType("application/json");
                          res.getWriter().write("{\"message\":\"Sign in to continue.\"}");
                        })
                    .accessDeniedHandler(
                        (req, res, e) -> {
                          res.setStatus(403);
                          res.setContentType("application/json");
                          res.getWriter()
                              .write(
                                  "{\"message\":\"Access denied or session expired. Refresh and"
                                      + " sign in again.\"}");
                        }));
    // Keep Spring Security's session CSRF protection. The UI obtains a token from /api/csrf.
    return http.build();
  }
}
```

## api/src/main/resources/application.properties

```properties
spring.application.name=move-api
server.address=127.0.0.1
server.port=8080
spring.config.import=optional:file:../.env[.properties],optional:file:.env[.properties]
spring.datasource.url=jdbc:h2:file:./data/move;DB_CLOSE_ON_EXIT=FALSE
spring.datasource.username=sa
spring.datasource.password=${MOVE_DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.open-in-view=false
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=11MB
server.servlet.session.timeout=30m
server.servlet.session.cookie.http-only=true
server.servlet.session.cookie.same-site=strict
server.error.include-message=never
server.error.include-stacktrace=never
move.encryption-key=${MOVE_ENCRYPTION_KEY}
move.applicant-user=${MOVE_APPLICANT_USER:applicant}
move.applicant-password=${MOVE_APPLICANT_PASSWORD}
move.reviewer-user=${MOVE_REVIEWER_USER:reviewer}
move.reviewer-password=${MOVE_REVIEWER_PASSWORD}
# CHANGE for deployment: real identity provider, managed database, TLS, secure cookie.
```

## api/src/test/java/org/move/api/ApiIntegrationTest.java

```java
package org.move.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @Autowired ApplicationRepository applications;
  @Autowired DocumentRepository documents;
  @Autowired ReviewRepository reviews;

  @BeforeEach
  void clean() {
    reviews.deleteAll();
    documents.deleteAll();
    applications.deleteAll();
  }

  String input() {
    return """
{"lastName":"Cole","middleInitial":"C","firstName":"Cameron","dob":"2000-01-01","ssn":"123-45-6789","monthlyIncome":740,
"reportingMonth":"2026-01","coveredReason":"","engagements":[
{"type":"EMPLOYMENT","name":"Employer","organizationId":"123","hours":40,"program":"","attendance":null},
{"type":"VOLUNTEERING","name":"Agency","organizationId":"456","hours":20,"program":"","attendance":null},
{"type":"JOB_TRAINING","name":"Training","organizationId":"789","hours":20,"program":"","attendance":null}]}
""";
  }

  MockHttpServletRequestBuilder applicant(MockHttpServletRequestBuilder request) {
    return request.with(user("applicant").roles("APPLICANT")).with(csrf());
  }

  MockHttpServletRequestBuilder reviewer(MockHttpServletRequestBuilder request) {
    return request.with(user("reviewer").roles("REVIEWER")).with(csrf());
  }

  JsonNode body(String response) throws Exception {
    return mapper.readTree(response);
  }

  JsonNode create() throws Exception {
    return body(
        mvc.perform(
                applicant(
                    post("/api/applications").contentType("application/json").content(input())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.totalHours").value(80))
            .andExpect(jsonPath("$.ssnMasked").value("***-**-6789"))
            .andExpect(jsonPath("$.ssn").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  JsonNode upload(JsonNode app) throws Exception {
    MockMultipartFile file =
        new MockMultipartFile(
            "file",
            "proof.pdf",
            "application/pdf",
            "%PDF-1.4\nProof".getBytes(StandardCharsets.US_ASCII));
    return body(
        mvc.perform(
                multipart("/api/applications/" + app.get("id").asText() + "/documents")
                    .file(file)
                    .param("documentType", "PAY_STUB")
                    .param("documentDate", "2026-01-15")
                    .with(user("applicant").roles("APPLICANT"))
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  JsonNode submit(JsonNode app) throws Exception {
    return body(
        mvc.perform(
                applicant(
                    post("/api/applications/" + app.get("id").asText() + "/submit")
                        .param("version", app.get("version").asText())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"))
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  void fullApplicationUploadSubmitReviewAndOwnershipFlow() throws Exception {
    var app = create();
    String id = app.get("id").asText();
    assertFalse(
        applications
            .findById(UUID.fromString(id))
            .orElseThrow()
            .encryptedPayload
            .contains("123-45-6789"));
    mvc.perform(get("/api/applications/" + id).with(user("other").roles("APPLICANT")))
        .andExpect(status().isNotFound());
    mvc.perform(reviewer(get("/api/applications/" + id))).andExpect(status().isNotFound());
    mvc.perform(applicant(post("/api/applications/" + id + "/submit").param("version", "0")))
        .andExpect(status().isBadRequest());
    app = upload(app);
    String docId = app.get("documents").get(0).get("id").asText();
    var encrypted = documents.findById(UUID.fromString(docId)).orElseThrow().encryptedBytes;
    assertFalse(new String(encrypted, StandardCharsets.ISO_8859_1).contains("%PDF"));
    mvc.perform(applicant(get("/api/applications/" + id + "/documents/" + docId)))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Disposition", "attachment; filename=\"proof.pdf\""))
        .andExpect(content().bytes("%PDF-1.4\nProof".getBytes(StandardCharsets.US_ASCII)));
    mvc.perform(
            get("/api/applications/" + id + "/documents/" + docId)
                .with(user("other").roles("APPLICANT")))
        .andExpect(status().isNotFound());
    app = submit(app);
    mvc.perform(
            applicant(
                put("/api/applications/" + id)
                    .param("version", app.get("version").asText())
                    .contentType("application/json")
                    .content(input())))
        .andExpect(status().isConflict());
    mvc.perform(applicant(delete("/api/applications/" + id + "/documents/" + docId)))
        .andExpect(status().isConflict());
    mvc.perform(reviewer(get("/api/applications")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(id));
    mvc.perform(
            applicant(
                post("/api/applications/" + id + "/decision")
                    .param("version", app.get("version").asText())
                    .contentType("application/json")
                    .content("{\"decision\":\"APPROVE\"}")))
        .andExpect(status().isForbidden());
    mvc.perform(
            reviewer(
                post("/api/applications/" + id + "/decision")
                    .param("version", app.get("version").asText())
                    .contentType("application/json")
                    .content(
                        "{\"decision\":\"APPROVE\",\"note\":\"Reviewed supporting documents.\"}")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APPROVED"));
    mvc.perform(reviewer(get("/api/applications/" + id + "/history")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].reviewer").value("reviewer"));
  }

  @Test
  void correctionResubmissionAndFurtherReview() throws Exception {
    var app = submit(upload(create()));
    String id = app.get("id").asText();
    mvc.perform(
            reviewer(
                post("/api/applications/" + id + "/decision")
                    .param("version", app.get("version").asText())
                    .contentType("application/json")
                    .content("{\"decision\":\"RETURN\"}")))
        .andExpect(status().isBadRequest());
    app =
        body(
            mvc.perform(
                    reviewer(
                        post("/api/applications/" + id + "/decision")
                            .param("version", app.get("version").asText())
                            .contentType("application/json")
                            .content(
                                "{\"decision\":\"RETURN\",\"note\":\"Please correct the"
                                    + " income.\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETURNED"))
                .andReturn()
                .getResponse()
                .getContentAsString());
    app =
        body(
            mvc.perform(
                    applicant(
                        put("/api/applications/" + id)
                            .param("version", app.get("version").asText())
                            .contentType("application/json")
                            .content(input().replace("123-45-6789", ""))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ssnMasked").value("***-**-6789"))
                .andReturn()
                .getResponse()
                .getContentAsString());
    app = submit(app);
    app =
        body(
            mvc.perform(
                    reviewer(
                        post("/api/applications/" + id + "/decision")
                            .param("version", app.get("version").asText())
                            .contentType("application/json")
                            .content(
                                "{\"decision\":\"FURTHER_REVIEW\",\"note\":\"Supervisor"
                                    + " verification required.\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FURTHER_REVIEW"))
                .andReturn()
                .getResponse()
                .getContentAsString());
    mvc.perform(
            reviewer(
                post("/api/applications/" + id + "/decision")
                    .param("version", app.get("version").asText())
                    .contentType("application/json")
                    .content("{\"decision\":\"APPROVE\"}")))
        .andExpect(status().isOk());
    assertEquals(3, reviews.findByApplicationIdOrderByAtAsc(UUID.fromString(id)).size());
  }

  @Test
  void validatesInputsAndStaleVersions() throws Exception {
    mvc.perform(
            applicant(
                post("/api/applications")
                    .contentType("application/json")
                    .content(input().replace("740", "-1"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.monthlyIncome").exists());
    mvc.perform(
            applicant(
                post("/api/applications")
                    .contentType("application/json")
                    .content(input().replace("123-45-6789", "bad"))))
        .andExpect(status().isBadRequest());
    mvc.perform(
            applicant(
                post("/api/applications")
                    .contentType("application/json")
                    .content(input().replace("2026-01", "2999-01"))))
        .andExpect(status().isBadRequest());
    mvc.perform(
            applicant(
                post("/api/applications")
                    .contentType("application/json")
                    .content(input().replace("EMPLOYMENT", "UNKNOWN"))))
        .andExpect(status().isBadRequest());
    var app = upload(create());
    mvc.perform(
            applicant(
                put("/api/applications/" + app.get("id").asText())
                    .param("version", "0")
                    .contentType("application/json")
                    .content(input())))
        .andExpect(status().isConflict());
    mvc.perform(applicant(get("/api/applications/not-a-uuid"))).andExpect(status().isBadRequest());
    mvc.perform(applicant(get("/api/applications/" + UUID.randomUUID())))
        .andExpect(status().isNotFound());
  }

  @Test
  void educationHasIndependentAttendanceWithoutEightyHourGate() throws Exception {
    var node = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(input());
    var entries = mapper.createArrayNode();
    var entry = mapper.createObjectNode();
    entry.put("type", "EDUCATION");
    entry.put("name", "STLCC");
    entry.put("organizationId", "s1");
    entry.put("hours", 0);
    entry.put("program", "Software Development");
    entry.put("attendance", "HALF_TIME");
    entries.add(entry);
    node.set("engagements", entries);
    var app =
        body(
            mvc.perform(
                    applicant(
                        post("/api/applications")
                            .contentType("application/json")
                            .content(node.toString())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalHours").value(0))
                .andReturn()
                .getResponse()
                .getContentAsString());
    submit(upload(app));
    entry.remove("attendance");
    mvc.perform(
            applicant(
                post("/api/applications").contentType("application/json").content(node.toString())))
        .andExpect(status().isBadRequest());
  }

  @Test
  void documentDeleteAndFormatValidation() throws Exception {
    var app = upload(create());
    String id = app.get("id").asText(), docId = app.get("documents").get(0).get("id").asText();
    mvc.perform(applicant(delete("/api/applications/" + id + "/documents/" + docId)))
        .andExpect(status().isNoContent());
    mvc.perform(applicant(get("/api/applications/" + id)))
        .andExpect(jsonPath("$.documents.length()").value(0));
    var fake = new MockMultipartFile("file", "bad.pdf", "application/pdf", "not pdf".getBytes());
    mvc.perform(
            multipart("/api/applications/" + id + "/documents")
                .file(fake)
                .param("documentType", "PAY_STUB")
                .param("documentDate", "2026-01-01")
                .with(user("applicant").roles("APPLICANT"))
                .with(csrf()))
        .andExpect(status().isBadRequest());
    mvc.perform(
            multipart("/api/applications/" + id + "/documents")
                .file(fake)
                .param("documentType", "PAY_STUB")
                .param("documentDate", "2999-01-01")
                .with(user("applicant").roles("APPLICANT"))
                .with(csrf()))
        .andExpect(status().isBadRequest());
  }

  @Test
  void realSessionLoginCsrfAndLogout() throws Exception {
    mvc.perform(get("/api/requirements"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categories.length()").value(4));
    mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/login")
                .param("username", "applicant")
                .param("password", "applicant-test-password"))
        .andExpect(status().isForbidden());
    var tokenResponse = mvc.perform(get("/api/csrf")).andExpect(status().isOk()).andReturn();
    var session = (MockHttpSession) tokenResponse.getRequest().getSession();
    var token = body(tokenResponse.getResponse().getContentAsString());
    var loggedIn =
        mvc.perform(
                post("/api/login")
                    .session(session)
                    .header(token.get("headerName").asText(), token.get("token").asText())
                    .param("username", "applicant")
                    .param("password", "applicant-test-password"))
            .andExpect(status().isNoContent())
            .andReturn();
    session = (MockHttpSession) loggedIn.getRequest().getSession();
    mvc.perform(get("/api/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("APPLICANT"));
    mvc.perform(
            post("/api/applications")
                .session(session)
                .contentType("application/json")
                .content(input()))
        .andExpect(status().isForbidden());
    token =
        body(
            mvc.perform(get("/api/csrf").session(session))
                .andReturn()
                .getResponse()
                .getContentAsString());
    mvc.perform(
            post("/api/logout")
                .session(session)
                .header(token.get("headerName").asText(), token.get("token").asText()))
        .andExpect(status().isNoContent());
    mvc.perform(
            post("/api/login")
                .with(csrf())
                .param("username", "applicant")
                .param("password", "wrong"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void coveredReasonCanBeSubmittedWithoutInventedActivities() throws Exception {
    var node = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(input());
    node.set("engagements", mapper.createArrayNode());
    node.put("coveredReason", "I am requesting staff review of a covered reason.");
    var app =
        body(
            mvc.perform(
                    applicant(
                        post("/api/applications")
                            .contentType("application/json")
                            .content(node.toString())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalHours").value(0))
                .andReturn()
                .getResponse()
                .getContentAsString());
    submit(upload(app));
    node.put("coveredReason", "");
    mvc.perform(
            applicant(
                post("/api/applications").contentType("application/json").content(node.toString())))
        .andExpect(status().isBadRequest());
  }
}
```

## api/src/test/java/org/move/api/CryptoTest.java

```java
package org.move.api;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Base64;
import org.junit.jupiter.api.Test;

class CryptoTest {
  Crypto crypto = new Crypto(Base64.getEncoder().encodeToString(new byte[32]));

  @Test
  void roundTripAndRandomIv() {
    String value = "Sensitive information";
    String one = crypto.encryptText(value), two = crypto.encryptText(value);
    assertNotEquals(one, two);
    assertEquals(value, crypto.decryptText(one));
  }

  @Test
  void rejectsWrongKeyTamperingAndInvalidKey() {
    byte[] encrypted = crypto.encrypt(new byte[] {1, 2, 3});
    encrypted[encrypted.length - 1] ^= 1;
    assertThrows(IllegalStateException.class, () -> crypto.decrypt(encrypted));
    assertThrows(IllegalArgumentException.class, () -> new Crypto("AAAA"));
  }
}
```

## api/src/test/java/org/move/api/FilePolicyTest.java

```java
package org.move.api;

import static org.junit.jupiter.api.Assertions.*;

import java.io.*;
import java.util.zip.*;
import org.junit.jupiter.api.Test;

class FilePolicyTest {
  FilePolicy policy = new FilePolicy();

  @Test
  void acceptsSupportedSignatures() throws Exception {
    assertEquals("application/pdf", policy.validate("a.PDF", "%PDF-1.4".getBytes()));
    assertEquals(
        "image/png", policy.validate("a.png", new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10}));
    assertEquals(
        "image/jpeg", policy.validate("a.jpg", new byte[] {(byte) 255, (byte) 216, (byte) 255}));
    assertEquals(
        "application/msword",
        policy.validate(
            "a.doc",
            new byte[] {
              (byte) 208, (byte) 207, 17, (byte) 224, (byte) 161, (byte) 177, 26, (byte) 225
            }));
    var bytes = new ByteArrayOutputStream();
    try (var zip = new ZipOutputStream(bytes)) {
      zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
      zip.write("test".getBytes());
      zip.closeEntry();
      zip.putNextEntry(new ZipEntry("word/document.xml"));
      zip.write("test".getBytes());
      zip.closeEntry();
    }
    assertTrue(policy.validate("a.docx", bytes.toByteArray()).contains("wordprocessingml"));
  }

  @Test
  void rejectsEmptyWrongOversizedAndSpoofedFiles() {
    assertThrows(Exception.class, () -> policy.validate("a.pdf", new byte[0]));
    assertThrows(Exception.class, () -> policy.validate("a.exe", "%PDF-".getBytes()));
    assertThrows(
        Exception.class, () -> policy.validate("a.pdf", new byte[FilePolicy.MAX_BYTES + 1]));
    assertThrows(Exception.class, () -> policy.validate("a.docx", "PKbad".getBytes()));
    assertThrows(Exception.class, () -> policy.validate("a.pdf", "wrong".getBytes()));
  }

  @Test
  void removesPathAndHeaderCharacters() {
    assertEquals("proof.pdf", policy.safeName("C:\\private\\proof.pdf"));
    assertEquals("bad___.pdf", policy.safeName("bad\r\n\".pdf"));
    assertTrue(policy.safeName("a".repeat(250) + ".pdf").length() <= 180);
  }
}
```

## api/src/test/resources/application.properties

```properties
spring.datasource.url=jdbc:h2:mem:move-test;DB_CLOSE_DELAY=-1
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.open-in-view=false
move.encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
move.applicant-user=applicant
move.applicant-password=applicant-test-password
move.reviewer-user=reviewer
move.reviewer-password=reviewer-test-password
```

## api/src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker

```
mock-maker-subclass
```

## package.json

```json
{
  "name": "move-monorepo",
  "private": true,
  "workspaces": [
    "ui"
  ],
  "scripts": {
    "setup": "node scripts/setup.mjs",
    "dev": "npm run dev --workspace ui",
    "dev:api": "node scripts/run-api.mjs spring-boot:run",
    "test:ui": "npm run test --workspace ui",
    "test:api": "node scripts/run-api.mjs test",
    "test": "npm run test:ui && npm run test:api",
    "build:ui": "npm run build --workspace ui",
    "test:e2e": "npm run test:e2e --workspace ui"
  }
}
```

## scripts/run-api.mjs

```javascript
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../api", import.meta.url));
const command = process.platform === "win32" ? "mvnw.cmd" : "./mvnw";
const child = spawn(command, process.argv.slice(2), {
  cwd,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
```

## scripts/setup.mjs

```javascript
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env"))
  console.log(".env already exists; it was left unchanged.");
else {
  const text = `MOVE_APPLICANT_USER=applicant\nMOVE_APPLICANT_PASSWORD=${randomBytes(18).toString("base64url")}\nMOVE_REVIEWER_USER=reviewer\nMOVE_REVIEWER_PASSWORD=${randomBytes(18).toString("base64url")}\nMOVE_DB_PASSWORD=${randomBytes(18).toString("base64url")}\nMOVE_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\n`;
  writeFileSync(".env", text, { mode: 0o600 });
  console.log(
    "Created .env. Open it in VS Code for the applicant and reviewer login passwords. Keep it private and keep the same encryption key for existing data.",
  );
}
```

## ui/e2e/move.spec.js

```javascript
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const settings = Object.fromEntries(
  readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .trim()
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
async function login(page, role) {
  await page
    .getByLabel("Username", { exact: true })
    .fill(settings[`MOVE_${role}_USER`]);
  await page
    .getByLabel("Password", { exact: true })
    .fill(settings[`MOVE_${role}_PASSWORD`]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
const personal = { firstName: "Cameron", lastName: `Test${Date.now()}` };
test("three-page real API workflow: application, uploads, correction, resubmission and employee approval", async ({
  page,
  browser,
}) => {
  await page.goto("/requirements");
  await expect(
    page.getByRole("heading", { name: "Medicaid Employment Requirements" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Covered Reasons" }).click();
  await expect(
    page.getByRole("link", { name: "Read current official Medicaid guidance" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await login(page, "APPLICANT");
  await page.getByLabel("Last name:", { exact: true }).fill(personal.lastName);
  await page.getByLabel("Middle initial:", { exact: true }).fill("C");
  await page
    .getByLabel("First name:", { exact: true })
    .fill(personal.firstName);
  await page.getByLabel("DOB:", { exact: true }).fill("2000-01-01");
  await page.getByLabel("SSN:", { exact: true }).fill("123-45-6789");
  await page.getByLabel("Reporting month:", { exact: true }).fill("2026-01");
  await page.getByLabel("Name of Employer", { exact: true }).fill("Employer");
  await page.getByLabel("EID", { exact: true }).fill("123");
  await page
    .getByLabel("Number of hours this month", { exact: true })
    .fill("40");
  await page
    .getByRole("button", { name: "Add another engagement type" })
    .click();
  const entry2 = page.getByRole("group", { name: "Engagement 2", exact: true });
  await entry2
    .getByLabel("Engagement type", { exact: true })
    .selectOption("VOLUNTEERING");
  await entry2.getByLabel("Volunteer Agency", { exact: true }).fill("Agency");
  await entry2.getByLabel("VID", { exact: true }).fill("456");
  await entry2
    .getByLabel("Number of hours this month", { exact: true })
    .fill("40");
  await page
    .getByLabel("Monthly income (pre-tax):", { exact: true })
    .fill("740");
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect(
    page.getByText(
      "Application saved. Upload supporting documents, then submit.",
    ),
  ).toBeVisible();
  await page.getByLabel("Date", { exact: true }).fill("2026-01-15");
  await page.getByLabel("Choose file", { exact: true }).setInputFiles({
    name: "proof.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF"),
  });
  await page
    .getByRole("button", { name: "Upload document", exact: true })
    .click();
  await expect(page.getByText("proof.pdf", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/application-desktop.png",
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "View / download", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe("proof.pdf");
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByText("Application submitted for employee review."),
  ).toBeVisible();
  const reviewerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
  });
  const reviewer = await reviewerContext.newPage();
  await reviewer.goto("/review");
  await login(reviewer, "REVIEWER");
  await expect(
    reviewer.getByRole("option", { name: new RegExp(personal.lastName) }),
  ).toBeAttached();
  const option = reviewer.getByRole("option", {
    name: new RegExp(personal.lastName),
  });
  const id = await option.getAttribute("value");
  await reviewer
    .getByLabel("Select an application", { exact: true })
    .selectOption(id);
  await expect(
    reviewer.getByText("***-**-6789", { exact: true }),
  ).toBeVisible();
  await expect(
    reviewer.getByRole("button", { name: "Return for Correction" }),
  ).toBeDisabled();
  await reviewer
    .getByLabel("Review note", { exact: true })
    .fill("Correct monthly income.");
  await reviewer.getByRole("button", { name: "Return for Correction" }).click();
  await expect(reviewer.getByText("Review decision saved.")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: new RegExp(personal.lastName) })
    .click();
  await expect(page.getByText(/Correct monthly income/)).toBeVisible();
  await page
    .getByLabel("Monthly income (pre-tax):", { exact: true })
    .fill("750");
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect(
    page.getByText(
      "Application saved. Upload supporting documents, then submit.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByText("Application submitted for employee review."),
  ).toBeVisible();
  await reviewer.getByRole("button", { name: "Refresh applications" }).click();
  await expect(
    reviewer.getByRole("option", { name: new RegExp(personal.lastName) }),
  ).toBeAttached();
  await reviewer
    .getByLabel("Select an application", { exact: true })
    .selectOption(id);
  await expect(reviewer.getByText("$750.00", { exact: true })).toBeVisible();
  await reviewer.getByRole("button", { name: "Approve & Submit" }).click();
  await expect(reviewer.getByText("Review decision saved.")).toBeVisible();
  await expect(
    reviewer.getByText("Status: approved", { exact: true }),
  ).toBeVisible();
  await reviewer.screenshot({
    path: "test-results/review-desktop.png",
    fullPage: true,
  });
  await reviewerContext.close();
});
test("mobile layouts have exactly three navigation links and no page overflow", async ({
  page,
}) => {
  await page.goto("/requirements");
  await expect(
    page.getByRole("button", { name: "View Covered Reasons" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/requirements-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/requirements");
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "View Covered Reasons" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/requirements-mobile.png",
    fullPage: true,
  });
});
```

## ui/index.html

```html
<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>MOVE | Missouri Medicaid Verification and Employment</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
```

## ui/package.json

```json
{
  "name": "move-ui",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@reduxjs/toolkit": "2.9.0",
    "react": "19.1.1",
    "react-dom": "19.1.1",
    "react-redux": "9.2.0",
    "react-router-dom": "7.9.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "5.0.3",
    "vite": "7.1.7",
    "sass": "1.93.2",
    "vitest": "3.2.4",
    "@vitest/coverage-v8": "3.2.4",
    "@testing-library/react": "16.3.0",
    "@testing-library/user-event": "14.6.1",
    "@testing-library/jest-dom": "6.8.0",
    "jsdom": "27.0.0",
    "@playwright/test": "1.55.1"
  }
}
```

## ui/playwright.config.js

```javascript
import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npm run dev:api",
      cwd: root,
      url: "http://127.0.0.1:8080/api/requirements",
      timeout: 180000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      cwd: root,
      url: "http://127.0.0.1:5173",
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

## ui/src/App.jsx

```jsx
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Routes, Route, Navigate } from "react-router-dom";
import { restoreSession } from "./features/sessionSlice";
import Layout from "./components/Layout";
import RequirementsPage from "./pages/RequirementsPage";
import ApplicationPage from "./pages/ApplicationPage";
import ReviewPage from "./pages/ReviewPage";
export default function App() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/requirements" replace />} />
        <Route path="requirements" element={<RequirementsPage />} />
        <Route path="application" element={<ApplicationPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="*" element={<Navigate to="/requirements" replace />} />
      </Route>
    </Routes>
  );
}
```

## ui/src/App.test.jsx

```jsx
import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import App from "./App";
import { renderWithStore } from "./test/helpers";
import { request } from "./api/client";
vi.mock("./api/client", () => ({ request: vi.fn() }));
it("redirects the root to the requirements page and restores the session", async () => {
  request.mockImplementation((path) =>
    path === "/me"
      ? Promise.reject(new Error("401"))
      : Promise.resolve({
          intro: "Report your activities.",
          categories: [],
          coveredReasons: "Covered reasons",
          guidanceUrl: "https://www.medicaid.gov/renew-info",
        }),
  );
  renderWithStore(<App />, { user: null, route: "/" });
  expect(
    await screen.findByRole("heading", {
      name: "Medicaid Employment Requirements",
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole("navigation")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/me");
});
```

## ui/src/api/client.js

```javascript
let csrf;
export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export function resetCsrf() {
  csrf = undefined;
}
async function token() {
  if (!csrf) {
    const response = await fetch("/api/csrf", { credentials: "same-origin" });
    if (!response.ok)
      throw new ApiError("Could not connect to the API.", response.status);
    csrf = await response.json();
  }
  return csrf;
}
export async function request(
  path,
  { method = "GET", body, blob = false } = {},
) {
  const headers = {};
  if (method !== "GET") {
    const value = await token();
    headers[value.headerName] = value.token;
  }
  if (
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams)
  ) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      "Could not connect to the API. Check that the Java server is running.",
      0,
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) resetCsrf();
    throw new ApiError(
      error.message || `Request failed (${response.status}).`,
      response.status,
      error.fields,
    );
  }
  if (response.status === 204) return null;
  return blob ? response.blob() : response.json();
}
export async function login(credentials) {
  await request("/login", {
    method: "POST",
    body: new URLSearchParams(credentials),
  });
  resetCsrf();
  return request("/me");
}
export async function logout() {
  await request("/logout", { method: "POST" });
  resetCsrf();
}
export async function downloadDocument(applicationId, document) {
  const blob = await request(
    `/applications/${applicationId}/documents/${document.id}`,
    { blob: true },
  );
  const url = URL.createObjectURL(blob);
  const link = documentElement(document.filename, url);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function documentElement(filename, url) {
  const element = globalThis.document.createElement("a");
  element.href = url;
  element.download = filename;
  globalThis.document.body.appendChild(element);
  return element;
}
```

## ui/src/api/client.test.js

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { request, login, logout, resetCsrf, downloadDocument } from "./client";
function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(["pdf"]),
  };
}
beforeEach(() => {
  resetCsrf();
  vi.stubGlobal("fetch", vi.fn());
});
describe("API client", () => {
  it("sends JSON with CSRF and session credentials", async () => {
    fetch
      .mockResolvedValueOnce(
        response({ token: "token", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response({ id: "a1" }));
    expect(
      await request("/applications", {
        method: "POST",
        body: { firstName: "Cameron" },
      }),
    ).toEqual({ id: "a1" });
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/applications",
      expect.objectContaining({
        credentials: "same-origin",
        headers: {
          "X-CSRF-TOKEN": "token",
          "Content-Type": "application/json",
        },
        body: '{"firstName":"Cameron"}',
      }),
    );
  });
  it("lets the browser set the multipart content type", async () => {
    fetch
      .mockResolvedValueOnce(
        response({ token: "t", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response({}));
    await request("/upload", { method: "POST", body: new FormData() });
    expect(fetch.mock.calls[1][1].headers).not.toHaveProperty("Content-Type");
  });
  it("surfaces validation and network errors", async () => {
    fetch.mockResolvedValueOnce(
      response({ message: "Invalid", fields: { ssn: "bad" } }, 400),
    );
    await expect(request("/application")).rejects.toMatchObject({
      message: "Invalid",
      status: 400,
      fields: { ssn: "bad" },
    });
    fetch.mockRejectedValueOnce(new Error("network"));
    await expect(request("/application")).rejects.toMatchObject({ status: 0 });
  });
  it("renews the token after login and logs out", async () => {
    fetch
      .mockResolvedValueOnce(
        response({ token: "old", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response(null, 204))
      .mockResolvedValueOnce(response({ role: "APPLICANT" }))
      .mockResolvedValueOnce(
        response({ token: "new", headerName: "X-CSRF-TOKEN" }),
      )
      .mockResolvedValueOnce(response(null, 204));
    expect(
      await login({ username: "applicant", password: "password" }),
    ).toEqual({ role: "APPLICANT" });
    await logout();
    expect(fetch.mock.calls[4][1].headers["X-CSRF-TOKEN"]).toBe("new");
  });
  it("downloads authenticated document bytes without exposing an unauthenticated URL", async () => {
    fetch.mockResolvedValueOnce(response({}));
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:proof"),
        revokeObjectURL: vi.fn(),
      }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await downloadDocument("a1", { id: "d1", filename: "proof.pdf" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/applications/a1/documents/d1",
      expect.anything(),
    );
    expect(click).toHaveBeenCalled();
  });
});
```

## ui/src/app/store.js

```javascript
import { configureStore } from "@reduxjs/toolkit";
import session from "../features/sessionSlice";
import applications from "../features/applicationSlice";
import requirements from "../features/requirementsSlice";
export const makeStore = (preloadedState) =>
  configureStore({
    reducer: { session, applications, requirements },
    preloadedState,
    // Personal records must not be copied into Redux DevTools or browser storage.
    devTools: false,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: {
          ignoredActions: [
            "applications/upload/pending",
            "applications/upload/fulfilled",
            "applications/upload/rejected",
          ],
          ignoredActionPaths: ["meta.arg.formData"],
        },
      }),
  });
export const store = makeStore();
```

## ui/src/app/store.test.js

```javascript
import { it, expect } from "vitest";
import { makeStore } from "./store";
it("creates independent stores with all three slices", () => {
  const a = makeStore(),
    b = makeStore();
  expect(Object.keys(a.getState())).toEqual([
    "session",
    "applications",
    "requirements",
  ]);
  expect(a).not.toBe(b);
  expect(a.getState().applications.items).toEqual([]);
});
```

## ui/src/components/ApplicationSummary.jsx

```jsx
import { TYPES } from "./EngagementFields";
export const readable = (value) =>
  (value || "").replaceAll("_", " ").toLowerCase();
export default function ApplicationSummary({ application: a }) {
  const education = a.engagements.filter((e) => e.type === "EDUCATION");
  return (
    <>
      <section className="card">
        <h2>Personal Information</h2>
        <dl className="personal-info">
          <dt>Last name:</dt>
          <dd>{a.lastName}</dd>
          <dt>Middle initial:</dt>
          <dd>{a.middleInitial || "—"}</dd>
          <dt>First name:</dt>
          <dd>{a.firstName}</dd>
          <dt>DOB:</dt>
          <dd>{a.dob}</dd>
          <dt>SSN:</dt>
          <dd>{a.ssnMasked}</dd>
        </dl>
      </section>
      <section className="card">
        <h2>Community Engagement</h2>
        <p>Reporting month: {a.reportingMonth}</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>ID</th>
                <th>Hours worked</th>
              </tr>
            </thead>
            <tbody>
              {a.engagements.map((entry, index) => (
                <tr key={index}>
                  <td>{TYPES[entry.type]}</td>
                  <td>{entry.name}</td>
                  <td>{entry.organizationId}</td>
                  <td>{entry.hours}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="3">Total:</th>
                <td>{a.totalHours}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p>
          <strong>Monthly income (pre-tax):</strong>
        </p>
        <p className="muted">
          {Number(a.monthlyIncome).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </p>
        {education.length > 0 && (
          <>
            <p>Student information:</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Major/Program</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {education.map((entry, index) => (
                    <tr key={index}>
                      <td>{entry.name}</td>
                      <td>{entry.program}</td>
                      <td>{readable(entry.attendance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {a.coveredReason && (
          <p>
            <strong>Covered reason provided:</strong> {a.coveredReason}
          </p>
        )}
      </section>
    </>
  );
}
```

## ui/src/components/ApplicationSummary.test.jsx

```jsx
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ApplicationSummary from "./ApplicationSummary";
import { application } from "../test/helpers";
it("renders actual submitted data, masked SSN, total hours, income and education", () => {
  const a = {
    ...application,
    engagements: [
      ...application.engagements,
      {
        type: "EDUCATION",
        name: "STLCC",
        program: "Software Development",
        attendance: "HALF_TIME",
        organizationId: "s1",
        hours: 0,
      },
    ],
  };
  render(<ApplicationSummary application={a} />);
  expect(screen.getByText("***-**-6789")).toBeInTheDocument();
  expect(screen.getByText("$740.00")).toBeInTheDocument();
  expect(screen.getByText("half time")).toBeInTheDocument();
  expect(screen.getByText("Software Development")).toBeInTheDocument();
});
```

## ui/src/components/DocumentUpload.jsx

```jsx
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { uploadDocument, deleteDocument } from "../features/applicationSlice";
import { downloadDocument } from "../api/client";
import { readable } from "./ApplicationSummary";
export const DOCUMENT_TYPES = {
  PAY_STUB: "Pay stub",
  EMPLOYER_LETTER: "Employer letter",
  SCHOOL_RECORD: "School record",
  VOLUNTEER_RECORD: "Volunteer record",
  TRAINING_RECORD: "Training record",
  OTHER: "Other",
};
export default function DocumentUpload({ application, editable = false }) {
  const dispatch = useDispatch();
  const pending = useSelector((s) => s.applications.pending);
  const [file, setFile] = useState(null);
  const [type, setType] = useState("PAY_STUB");
  const [date, setDate] = useState("");
  const [error, setError] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  async function upload(event) {
    event.preventDefault();
    setError(null);
    if (!file || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError("Select a nonempty file of 10 MB or less.");
      return;
    }
    if (!/\.(pdf|jpe?g|png|docx?)$/i.test(file.name)) {
      setError("Select a PDF, JPG, PNG, DOC, or DOCX file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", type);
    formData.append("documentDate", date);
    const action = await dispatch(
      uploadDocument({ id: application.id, formData }),
    );
    if (uploadDocument.fulfilled.match(action)) {
      setFile(null);
      setFileKey((k) => k + 1);
    }
  }
  async function view(document) {
    setError(null);
    try {
      await downloadDocument(application.id, document);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="card documents">
      <h2>{editable ? "Employment Information" : "Supporting Documents"}</h2>
      {editable && (
        <>
          <p>
            Please upload proof of your employment, enrollment, community
            service, or training.
          </p>
          <p>
            <strong>Applicant Name:</strong> {application.firstName}{" "}
            {application.lastName}
          </p>
          <form onSubmit={upload}>
            <fieldset disabled={pending > 0}>
              <legend>Upload file</legend>
              <div className="two-columns">
                <div>
                  <label htmlFor="document-type">Document Type</label>
                  <select
                    id="document-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="document-date">Date</label>
                  <input
                    id="document-date"
                    type="date"
                    max={new Date().toLocaleDateString("en-CA")}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p id="file-help">
                Accepted formats: PDF, JPG, PNG, DOC/DOCX. Maximum 10 MB per
                file, 20 files per application.
              </p>
              <input
                key={fileKey}
                aria-label="Choose file"
                aria-describedby="file-help"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <button disabled={!file || !date}>Upload document</button>
            </fieldset>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <h3>Uploaded Documents</h3>
      {application.documents.length === 0 ? (
        <p>No documents uploaded yet.</p>
      ) : (
        <ul className="document-list">
          {application.documents.map((document) => (
            <li key={document.id}>
              <strong>{document.filename}</strong>
              <p>
                Document Type: {DOCUMENT_TYPES[document.documentType]}
                <br />
                Document date: {document.documentDate}
                <br />
                Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                <br />
                Status: {readable(document.status)}
              </p>
              <div className="button-row">
                <button type="button" onClick={() => view(document)}>
                  View / download
                </button>
                {editable && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={pending > 0}
                    onClick={() => {
                      if (window.confirm(`Delete ${document.filename}?`))
                        dispatch(
                          deleteDocument({
                            id: application.id,
                            documentId: document.id,
                          }),
                        );
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

## ui/src/components/DocumentUpload.test.jsx

```jsx
import { it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentUpload from "./DocumentUpload";
import { renderWithStore, application } from "../test/helpers";
import { request, downloadDocument } from "../api/client";
vi.mock("../api/client", () => ({
  request: vi.fn(),
  downloadDocument: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("uploads metadata and file together, then clears the file input", async () => {
  request.mockResolvedValue(application);
  renderWithStore(<DocumentUpload application={application} editable />);
  const file = new File(["%PDF-1.4"], "proof.pdf", { type: "application/pdf" });
  await userEvent.upload(screen.getByLabelText("Choose file"), file);
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2026-01-01" },
  });
  /* jsdom's file-input constraint validation does not recognize user-event's synthetic FileList. Browser behavior is covered by Playwright. */ fireEvent.submit(
    screen.getByRole("button", { name: "Upload document" }).closest("form"),
  );
  expect(request).toHaveBeenCalledWith(
    "/applications/a1/documents",
    expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
  );
  const body = request.mock.calls[0][1].body;
  expect(body.get("documentType")).toBe("PAY_STUB");
  expect(body.get("file").name).toBe("proof.pdf");
  await waitFor(() =>
    expect(screen.getByLabelText("Choose file").files).toHaveLength(0),
  );
});
it("views and deletes saved documents, while review mode is read only", async () => {
  const doc = {
    id: "d1",
    filename: "proof.pdf",
    documentType: "PAY_STUB",
    documentDate: "2026-01-01",
    uploadedAt: "2026-01-01T00:00:00Z",
    status: "Received",
  };
  const a = { ...application, documents: [doc] };
  request.mockResolvedValue(application);
  downloadDocument.mockResolvedValue(null);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderWithStore(<DocumentUpload application={a} editable />);
  await userEvent.click(
    screen.getByRole("button", { name: "View / download" }),
  );
  expect(downloadDocument).toHaveBeenCalledWith("a1", doc);
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(request).toHaveBeenCalledWith("/applications/a1/documents/d1", {
    method: "DELETE",
  });
});
it("does not allow reviewer upload/delete controls", () => {
  renderWithStore(<DocumentUpload application={application} />);
  expect(screen.queryByLabelText("Choose file")).not.toBeInTheDocument();
});
```

## ui/src/components/EngagementFields.jsx

```jsx
import Field from "./Field";
export const TYPES = {
  EMPLOYMENT: "Employment",
  VOLUNTEERING: "Volunteering",
  EDUCATION: "Education",
  JOB_TRAINING: "Job training",
};
const labels = {
  EMPLOYMENT: ["Name of Employer", "EID"],
  VOLUNTEERING: ["Volunteer Agency", "VID"],
  EDUCATION: ["Name of School", "EID"],
  JOB_TRAINING: ["Job Training Program", "JTID"],
};
export function blankEngagement() {
  return {
    type: "EMPLOYMENT",
    name: "",
    organizationId: "",
    hours: "",
    program: "",
    attendance: "",
  };
}
export default function EngagementFields({
  entry,
  index,
  onChange,
  onRemove,
  canRemove,
  disabled,
  errors = {},
}) {
  const prefix = `engagement-${index}`;
  const names = labels[entry.type];
  return (
    <fieldset className="engagement" disabled={disabled}>
      <legend>Engagement {index + 1}</legend>
      <label htmlFor={`${prefix}-type`}>Engagement type</label>
      <select
        id={`${prefix}-type`}
        value={entry.type}
        onChange={(e) =>
          onChange({ ...blankEngagement(), type: e.target.value })
        }
      >
        {Object.entries(TYPES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <Field
        id={`${prefix}-name`}
        label={names[0]}
        value={entry.name}
        onChange={(e) => onChange({ ...entry, name: e.target.value })}
        maxLength={160}
        required
        error={errors[`engagements[${index}].name`]}
      />
      <Field
        id={`${prefix}-id`}
        label={names[1]}
        value={entry.organizationId}
        onChange={(e) => onChange({ ...entry, organizationId: e.target.value })}
        maxLength={60}
        required
        error={errors[`engagements[${index}].organizationId`]}
      />
      {entry.type === "EDUCATION" && (
        <>
          <Field
            id={`${prefix}-program`}
            label="Major/Program"
            value={entry.program || ""}
            onChange={(e) => onChange({ ...entry, program: e.target.value })}
            maxLength={160}
            required
          />
          <label htmlFor={`${prefix}-attendance`}>Attendance</label>
          <select
            id={`${prefix}-attendance`}
            value={entry.attendance || ""}
            onChange={(e) => onChange({ ...entry, attendance: e.target.value })}
            required
          >
            <option value="">Choose attendance</option>
            <option value="FULL_TIME">Full time</option>
            <option value="HALF_TIME">Half time</option>
            <option value="LESS_THAN_HALF_TIME">Less than half time</option>
          </select>
          <p className="hint">
            Report your enrollment level. Staff review educational eligibility
            separately from reported hours.
          </p>
        </>
      )}
      <Field
        id={`${prefix}-hours`}
        label={
          entry.type === "EDUCATION"
            ? "Classroom hours this month (optional)"
            : "Number of hours this month"
        }
        type="number"
        min="0"
        max="744"
        step="0.25"
        value={entry.hours}
        onChange={(e) => onChange({ ...entry, hours: e.target.value })}
        required={entry.type !== "EDUCATION"}
        error={errors[`engagements[${index}].hours`]}
      />
      {canRemove && (
        <button type="button" className="secondary" onClick={onRemove}>
          Remove engagement {index + 1}
        </button>
      )}
    </fieldset>
  );
}
```

## ui/src/components/EngagementFields.test.jsx

```jsx
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EngagementFields, { blankEngagement } from "./EngagementFields";
it("switches engagement type and allows removing another entry", () => {
  const onChange = vi.fn(),
    onRemove = vi.fn();
  render(
    <EngagementFields
      entry={blankEngagement()}
      index={1}
      canRemove
      onChange={onChange}
      onRemove={onRemove}
    />,
  );
  fireEvent.change(screen.getByLabelText("Engagement type"), {
    target: { value: "EDUCATION" },
  });
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ type: "EDUCATION" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove engagement 2" }));
  expect(onRemove).toHaveBeenCalled();
});
it("supports half-time education without mandatory classroom hours", () => {
  render(
    <EngagementFields
      entry={{ ...blankEngagement(), type: "EDUCATION" }}
      index={0}
      onChange={() => {}}
    />,
  );
  expect(screen.getByRole("option", { name: "Half time" })).toBeInTheDocument();
  expect(
    screen.getByLabelText("Classroom hours this month (optional)"),
  ).not.toBeRequired();
  expect(screen.getByLabelText("Major/Program")).toBeRequired();
});
```

## ui/src/components/Field.jsx

```jsx
export default function Field({ id, label, error, ...props }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
```

## ui/src/components/Field.test.jsx

```jsx
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Field from "./Field";
it("connects a label and error to the input", () => {
  render(<Field id="ssn" label="SSN:" error="Invalid SSN" />);
  const input = screen.getByLabelText("SSN:");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Invalid SSN");
});
```

## ui/src/components/Layout.jsx

```jsx
import { NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "../features/sessionSlice";
export default function Layout() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.session.user);
  return (
    <>
      <header className="header">
        <h1>Missouri Medicaid Verification and Employment–MOVE</h1>
      </header>
      <nav className="navigation" aria-label="Main navigation">
        <strong>Missouri Medicaid</strong>
        <div>
          <NavLink to="/requirements">Requirements</NavLink>
          <NavLink to="/application">Application</NavLink>
          <NavLink to="/review">Employee Review</NavLink>
        </div>
      </nav>
      {user && (
        <div className="account">
          <span>
            Signed in as {user.username} ({user.role.toLowerCase()})
          </span>
          <button className="secondary" onClick={() => dispatch(signOut())}>
            Sign out
          </button>
        </div>
      )}
      <main id="main-content">
        <Outlet />
      </main>
      <footer>
        MOVE course project · Missouri Medicaid Verification and Employment
      </footer>
    </>
  );
}
```

## ui/src/components/Layout.test.jsx

```jsx
import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Layout from "./Layout";
import { renderWithStore } from "../test/helpers";
import { logout } from "../api/client";
vi.mock("../api/client", () => ({ logout: vi.fn() }));
it("links exactly three pages and signs out", async () => {
  logout.mockResolvedValue(null);
  const { store } = renderWithStore(<Layout />);
  expect(screen.getAllByRole("link")).toHaveLength(3);
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(store.getState().session.user).toBeNull();
});
```

## ui/src/components/SignIn.jsx

```jsx
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { signIn } from "../features/sessionSlice";
export default function SignIn() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.session);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  async function submit(event) {
    event.preventDefault();
    await dispatch(signIn({ username, password }));
    setPassword("");
  }
  return (
    <section className="card sign-in">
      <h2>Sign in</h2>
      <p>Applicants submit records. Employees review submitted applications.</p>
      <form onSubmit={submit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p role="alert">{error}</p>}
        <button disabled={status === "loading"}>
          {status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
```

## ui/src/components/SignIn.test.jsx

```jsx
import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "../test/helpers";
import SignIn from "./SignIn";
import { login } from "../api/client";
vi.mock("../api/client", () => ({ login: vi.fn() }));
it("signs in through the API and clears the password field", async () => {
  login.mockResolvedValue({ username: "applicant", role: "APPLICANT" });
  renderWithStore(<SignIn />, { user: null });
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "applicant");
  await user.type(screen.getByLabelText("Password"), "private");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(login).toHaveBeenCalledWith({
    username: "applicant",
    password: "private",
  });
  expect(screen.getByLabelText("Password")).toHaveValue("");
});
```

## ui/src/features/applicationSlice.js

```javascript
import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import { request } from "../api/client";
import { expired, signIn, signOut } from "./sessionSlice";
const thunk = (name, fn) =>
  createAsyncThunk(`applications/${name}`, async (arg, context) => {
    try {
      return await fn(arg);
    } catch (e) {
      if (e.status === 401) context.dispatch(expired());
      return context.rejectWithValue({
        message: e.message,
        fields: e.fields || {},
      });
    }
  });
export const loadApplications = thunk("list", () => request("/applications"));
export const loadApplication = thunk("load", (id) =>
  request(`/applications/${id}`),
);
export const saveApplication = thunk("save", ({ id, version, data }) =>
  request(id ? `/applications/${id}?version=${version}` : "/applications", {
    method: id ? "PUT" : "POST",
    body: data,
  }),
);
export const submitApplication = thunk("submit", ({ id, version }) =>
  request(`/applications/${id}/submit?version=${version}`, { method: "POST" }),
);
export const uploadDocument = thunk("upload", ({ id, formData }) =>
  request(`/applications/${id}/documents`, { method: "POST", body: formData }),
);
export const deleteDocument = thunk("delete", async ({ id, documentId }) => {
  await request(`/applications/${id}/documents/${documentId}`, {
    method: "DELETE",
  });
  return request(`/applications/${id}`);
});
export const recordDecision = thunk(
  "decision",
  ({ id, version, decision, note }) =>
    request(`/applications/${id}/decision?version=${version}`, {
      method: "POST",
      body: { decision, note },
    }),
);
export const loadHistory = thunk("history", (id) =>
  request(`/applications/${id}/history`),
);
const changes = [
  loadApplication,
  saveApplication,
  submitApplication,
  uploadDocument,
  deleteDocument,
  recordDecision,
];
const operations = [loadApplications, loadHistory, ...changes];
const initialState = {
  items: [],
  current: null,
  history: [],
  pending: 0,
  error: null,
  fields: {},
};
const slice = createSlice({
  name: "applications",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
      state.fields = {};
    },
    clearCurrent(state) {
      state.current = null;
      state.history = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signOut.fulfilled, () => initialState)
      .addCase(signIn.fulfilled, () => initialState)
      .addCase(expired, () => initialState)
      .addCase(loadApplications.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(loadHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      })
      .addMatcher(
        isAnyOf(...changes.map((t) => t.fulfilled)),
        (state, action) => {
          state.current = action.payload;
          const index = state.items.findIndex(
            (a) => a.id === action.payload.id,
          );
          if (index < 0) state.items.unshift(action.payload);
          else state.items[index] = action.payload;
        },
      )
      .addMatcher(isAnyOf(...operations.map((t) => t.pending)), (state) => {
        state.pending += 1;
        state.error = null;
        state.fields = {};
      })
      .addMatcher(isAnyOf(...operations.map((t) => t.fulfilled)), (state) => {
        state.pending = Math.max(0, state.pending - 1);
      })
      .addMatcher(
        isAnyOf(...operations.map((t) => t.rejected)),
        (state, action) => {
          state.pending = Math.max(0, state.pending - 1);
          state.error = action.payload?.message || action.error.message;
          state.fields = action.payload?.fields || {};
        },
      );
  },
});
export const { clearError, clearCurrent } = slice.actions;
export default slice.reducer;
```

## ui/src/features/applicationSlice.test.js

```javascript
import { it, expect, vi, beforeEach } from "vitest";
import { makeStore } from "../app/store";
import * as api from "../api/client";
import { application } from "../test/helpers";
import {
  loadApplications,
  loadApplication,
  saveApplication,
  submitApplication,
  uploadDocument,
  deleteDocument,
  recordDecision,
  loadHistory,
  clearCurrent,
} from "./applicationSlice";
import { signOut } from "./sessionSlice";
vi.mock("../api/client", () => ({ request: vi.fn(), logout: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("loads a list and current application", async () => {
  const store = makeStore();
  api.request
    .mockResolvedValueOnce([application])
    .mockResolvedValueOnce(application);
  await store.dispatch(loadApplications());
  await store.dispatch(loadApplication("a1"));
  expect(store.getState().applications.current).toEqual(application);
  expect(store.getState().applications.items).toHaveLength(1);
  expect(store.getState().applications.pending).toBe(0);
  store.dispatch(clearCurrent());
  expect(store.getState().applications.current).toBeNull();
});
it("uses the same versioned API contract for create, update, submit, upload, delete, and decisions", async () => {
  const store = makeStore();
  api.request.mockResolvedValue(application);
  await store.dispatch(saveApplication({ data: { firstName: "Cameron" } }));
  await store.dispatch(saveApplication({ id: "a1", version: 3, data: {} }));
  await store.dispatch(submitApplication({ id: "a1", version: 3 }));
  const formData = new FormData();
  await store.dispatch(uploadDocument({ id: "a1", formData }));
  await store.dispatch(deleteDocument({ id: "a1", documentId: "d1" }));
  await store.dispatch(
    recordDecision({
      id: "a1",
      version: 3,
      decision: "APPROVE",
      note: "Reviewed",
    }),
  );
  expect(api.request).toHaveBeenCalledWith("/applications/a1?version=3", {
    method: "PUT",
    body: {},
  });
  expect(api.request).toHaveBeenCalledWith(
    "/applications/a1/submit?version=3",
    { method: "POST" },
  );
  expect(api.request).toHaveBeenCalledWith("/applications/a1/documents", {
    method: "POST",
    body: formData,
  });
  expect(api.request).toHaveBeenCalledWith("/applications/a1/documents/d1", {
    method: "DELETE",
  });
  expect(api.request).toHaveBeenCalledWith(
    "/applications/a1/decision?version=3",
    expect.objectContaining({
      body: { decision: "APPROVE", note: "Reviewed" },
    }),
  );
});
it("loads history, handles rejected validation and clears personal records on logout", async () => {
  const store = makeStore();
  api.request.mockResolvedValueOnce([{ id: "r1" }]);
  await store.dispatch(loadHistory("a1"));
  expect(store.getState().applications.history).toHaveLength(1);
  api.request.mockRejectedValueOnce({
    message: "Invalid SSN",
    fields: { ssn: "Invalid" },
  });
  await store.dispatch(saveApplication({ data: {} }));
  expect(store.getState().applications.error).toBe("Invalid SSN");
  api.logout.mockResolvedValue(null);
  await store.dispatch(signOut());
  expect(store.getState().applications.history).toHaveLength(0);
});
it("expires the session on unauthorized responses", async () => {
  const store = makeStore({
    session: { user: { role: "APPLICANT" }, status: "ready" },
  });
  api.request.mockRejectedValue({ status: 401, message: "Expired" });
  await store.dispatch(loadApplications());
  expect(store.getState().session.user).toBeNull();
});
```

## ui/src/features/requirementsSlice.js

```javascript
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { request } from "../api/client";
export const loadRequirements = createAsyncThunk("requirements/load", () =>
  request("/requirements"),
);
const slice = createSlice({
  name: "requirements",
  initialState: { data: null, status: "idle", error: null },
  reducers: {},
  extraReducers: (b) =>
    b
      .addCase(loadRequirements.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(loadRequirements.fulfilled, (s, a) => {
        s.data = a.payload;
        s.status = "ready";
      })
      .addCase(loadRequirements.rejected, (s) => {
        s.status = "failed";
        s.error =
          "Requirements could not be loaded. Check that the API is running.";
      }),
});
export default slice.reducer;
```

## ui/src/features/requirementsSlice.test.js

```javascript
import { it, expect, vi } from "vitest";
import { makeStore } from "../app/store";
import { loadRequirements } from "./requirementsSlice";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
it("loads API requirements and exposes errors for retry", async () => {
  const store = makeStore();
  request.mockResolvedValueOnce({ categories: ["Employment"] });
  await store.dispatch(loadRequirements());
  expect(store.getState().requirements.status).toBe("ready");
  request.mockRejectedValueOnce(new Error("Offline"));
  await store.dispatch(loadRequirements());
  expect(store.getState().requirements.status).toBe("failed");
});
```

## ui/src/features/sessionSlice.js

```javascript
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "../api/client";
export const restoreSession = createAsyncThunk("session/restore", async () =>
  api.request("/me"),
);
export const signIn = createAsyncThunk(
  "session/signIn",
  async (credentials, { rejectWithValue }) => {
    try {
      return await api.login(credentials);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  },
);
export const signOut = createAsyncThunk("session/signOut", async () =>
  api.logout(),
);
const slice = createSlice({
  name: "session",
  initialState: { user: null, status: "idle", error: null },
  reducers: {
    expired(state) {
      state.user = null;
      state.error = "Your session expired. Sign in again.";
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "ready";
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = "ready";
      })
      .addCase(signIn.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "ready";
      })
      .addCase(signIn.rejected, (state, action) => {
        state.status = "ready";
        state.error = action.payload || "Sign in failed.";
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.error = null;
      })
      .addCase(signOut.rejected, (state) => {
        state.error = "Sign out failed. Try again.";
      }),
});
export const { expired } = slice.actions;
export default slice.reducer;
```

## ui/src/features/sessionSlice.test.js

```javascript
import { it, expect, vi, beforeEach } from "vitest";
import { makeStore } from "../app/store";
import { signIn, signOut, restoreSession } from "./sessionSlice";
import * as api from "../api/client";
vi.mock("../api/client", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  request: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("restores and signs in using API role data", async () => {
  const store = makeStore();
  api.request.mockResolvedValue({ username: "reviewer", role: "REVIEWER" });
  await store.dispatch(restoreSession());
  expect(store.getState().session.user.role).toBe("REVIEWER");
  api.login.mockResolvedValue({ username: "applicant", role: "APPLICANT" });
  await store.dispatch(signIn({ username: "applicant", password: "test" }));
  expect(store.getState().session.user.role).toBe("APPLICANT");
  api.logout.mockResolvedValue(null);
  await store.dispatch(signOut());
  expect(store.getState().session.user).toBeNull();
});
it("handles invalid credentials and absent session", async () => {
  const store = makeStore();
  api.request.mockRejectedValue(new Error("401"));
  await store.dispatch(restoreSession());
  expect(store.getState().session.status).toBe("ready");
  api.login.mockRejectedValue(new Error("Invalid password"));
  await store.dispatch(signIn({}));
  expect(store.getState().session.error).toBe("Invalid password");
});
```

## ui/src/main.jsx

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./app/store";
import App from "./App";
import "./styles.scss";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
```

## ui/src/pages/ApplicationPage.jsx

```jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  loadApplications,
  loadApplication,
  saveApplication,
  submitApplication,
  clearCurrent,
} from "../features/applicationSlice";
import SignIn from "../components/SignIn";
import Field from "../components/Field";
import EngagementFields, {
  blankEngagement,
} from "../components/EngagementFields";
import DocumentUpload from "../components/DocumentUpload";
import ApplicationSummary, { readable } from "../components/ApplicationSummary";
export function emptyForm() {
  return {
    lastName: "",
    middleInitial: "",
    firstName: "",
    dob: "",
    ssn: "",
    monthlyIncome: "",
    engagements: [blankEngagement()],
    reportingMonth: new Date().toLocaleDateString("en-CA").slice(0, 7),
    coveredReason: "",
  };
}
export function toInput(form) {
  return {
    ...form,
    monthlyIncome: Number(form.monthlyIncome),
    engagements: form.engagements.map((e) => ({
      ...e,
      hours: Number(e.hours || 0),
      attendance: e.attendance || null,
    })),
  };
}
export default function ApplicationPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.session.user);
  const { items, current, pending, error, fields } = useSelector(
    (s) => s.applications,
  );
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (user?.role === "APPLICANT") dispatch(loadApplications());
  }, [dispatch, user]);
  useEffect(() => {
    if (current) {
      const {
        lastName,
        middleInitial,
        firstName,
        dob,
        monthlyIncome,
        engagements,
        reportingMonth,
        coveredReason,
      } = current;
      setForm({
        lastName,
        middleInitial: middleInitial || "",
        firstName,
        dob,
        ssn: "",
        monthlyIncome,
        engagements: engagements.map((e) => ({
          ...e,
          program: e.program || "",
          attendance: e.attendance || "",
        })),
        reportingMonth,
        coveredReason: coveredReason || "",
      });
      setSaved(true);
    }
  }, [current]);
  const editable = !current || ["DRAFT", "RETURNED"].includes(current.status);
  function change(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    setMessage("");
  }
  async function save(event) {
    event.preventDefault();
    setMessage("");
    const action = await dispatch(
      saveApplication({
        id: current?.id,
        version: current?.version,
        data: toInput(form),
      }),
    );
    if (saveApplication.fulfilled.match(action)) {
      setSaved(true);
      setMessage(
        "Application saved. Upload supporting documents, then submit.",
      );
    }
  }
  async function submit() {
    setMessage("");
    const action = await dispatch(
      submitApplication({ id: current.id, version: current.version }),
    );
    if (submitApplication.fulfilled.match(action))
      setMessage("Application submitted for employee review.");
  }
  function startNew() {
    dispatch(clearCurrent());
    setForm(emptyForm());
    setSaved(false);
    setMessage("");
  }
  if (!user) return <SignIn />;
  if (user.role !== "APPLICANT")
    return (
      <section className="card">
        <h2>Applicant account required</h2>
        <p>Use an applicant account to submit records.</p>
        <Link to="/review">Open Employee Review</Link>
      </section>
    );
  return (
    <>
      <section className="card">
        <h2>My Applications</h2>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            disabled={pending > 0}
            onClick={startNew}
          >
            Start new application
          </button>
          <button
            type="button"
            className="secondary"
            disabled={pending > 0}
            onClick={() => {
              if (
                current &&
                !saved &&
                !window.confirm("Reload saved data and discard unsaved edits?")
              )
                return;
              current
                ? dispatch(loadApplication(current.id))
                : dispatch(loadApplications());
            }}
          >
            Reload saved data
          </button>
        </div>
        {items.length === 0 && <p>No saved applications yet.</p>}
        <ul className="application-list">
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="text-button"
                disabled={pending > 0}
                onClick={() => {
                  if (
                    !saved &&
                    (form.firstName || current) &&
                    !window.confirm(
                      "Open this application and discard unsaved edits?",
                    )
                  )
                    return;
                  setMessage("");
                  dispatch(loadApplication(a.id));
                }}
              >
                {a.firstName} {a.lastName} · {a.reportingMonth} ·{" "}
                {readable(a.status)}
              </button>
            </li>
          ))}
        </ul>
        {current && (
          <p>
            <strong>Status:</strong> {readable(current.status)}
            {current.reviewNote && <> · Staff note: {current.reviewNote}</>}
          </p>
        )}
      </section>
      {pending > 0 && <p role="status">Working…</p>}
      {error && (
        <div role="alert" className="error">
          {error}
          {Object.keys(fields).length > 0 && (
            <ul>
              {Object.entries(fields).map(([field, value]) => (
                <li key={field}>
                  {field}: {value}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {editable ? (
        <form onSubmit={save}>
          <fieldset disabled={pending > 0} className="form-fieldset">
            <section className="card">
              <h2>Personal Information</h2>
              <Field
                id="last-name"
                label="Last name:"
                value={form.lastName}
                onChange={(e) => change("lastName", e.target.value)}
                maxLength={80}
                required
                error={fields.lastName}
              />
              <Field
                id="middle-initial"
                label="Middle initial:"
                value={form.middleInitial}
                onChange={(e) => change("middleInitial", e.target.value)}
                maxLength={1}
                pattern="[A-Za-z]?"
                error={fields.middleInitial}
              />
              <Field
                id="first-name"
                label="First name:"
                value={form.firstName}
                onChange={(e) => change("firstName", e.target.value)}
                maxLength={80}
                required
                error={fields.firstName}
              />
              <Field
                id="dob"
                label="DOB:"
                type="date"
                value={form.dob}
                onChange={(e) => change("dob", e.target.value)}
                required
                error={fields.dob}
              />
              <Field
                id="ssn"
                label={
                  current
                    ? `SSN: ${current.ssnMasked} (leave blank to keep)`
                    : "SSN:"
                }
                type="password"
                autoComplete="off"
                placeholder="XXX-XX-XXXX"
                value={form.ssn}
                onChange={(e) => change("ssn", e.target.value)}
                pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}"
                maxLength={11}
                required={!current}
                error={fields.ssn}
              />
              <Field
                id="reporting-month"
                label="Reporting month:"
                type="month"
                max={emptyForm().reportingMonth}
                value={form.reportingMonth}
                onChange={(e) => change("reportingMonth", e.target.value)}
                required
                error={fields.reportingMonth}
              />
            </section>
            <section className="card">
              <h2>Community Engagement</h2>
              <label className="covered-choice">
                <input
                  type="checkbox"
                  checked={form.engagements.length === 0}
                  onChange={(e) =>
                    change(
                      "engagements",
                      e.target.checked ? [] : [blankEngagement()],
                    )
                  }
                />
                I am reporting a covered reason instead of activities
              </label>
              {form.engagements.length === 0 && (
                <p>
                  Describe your covered reason below and upload supporting proof
                  for staff review.
                </p>
              )}
              {form.engagements.map((entry, index) => (
                <EngagementFields
                  key={index}
                  entry={entry}
                  index={index}
                  errors={fields}
                  disabled={pending > 0}
                  canRemove={form.engagements.length > 1}
                  onRemove={() =>
                    change(
                      "engagements",
                      form.engagements.filter((_, i) => i !== index),
                    )
                  }
                  onChange={(value) =>
                    change(
                      "engagements",
                      form.engagements.map((e, i) => (i === index ? value : e)),
                    )
                  }
                />
              ))}
              <button
                type="button"
                className="secondary"
                disabled={form.engagements.length >= 20}
                onClick={() =>
                  change("engagements", [
                    ...form.engagements,
                    blankEngagement(),
                  ])
                }
              >
                Add another engagement type
              </button>
            </section>
            <section className="card">
              <Field
                id="income"
                label="Monthly income (pre-tax):"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                value={form.monthlyIncome}
                onChange={(e) => change("monthlyIncome", e.target.value)}
                required
                error={fields.monthlyIncome}
              />
              <label htmlFor="covered-reason">
                Covered reason or explanation
              </label>
              <textarea
                id="covered-reason"
                maxLength={2000}
                value={form.coveredReason}
                required={form.engagements.length === 0}
                onChange={(e) => change("coveredReason", e.target.value)}
              />
              <button>Save application</button>
              <p className="hint">
                Save your information first to enable document uploads. Saved
                applications remain drafts until you submit.
              </p>
            </section>
          </fieldset>
        </form>
      ) : (
        <ApplicationSummary application={current} />
      )}
      {current && (
        <DocumentUpload application={current} editable={editable && saved} />
      )}
      {current && editable && (
        <section className="card">
          <button
            type="button"
            disabled={pending > 0 || !saved || current.documents.length === 0}
            onClick={submit}
          >
            Submit application
          </button>
          {!saved && <p>Save your changes before uploading or submitting.</p>}
        </section>
      )}
      <Link className="button secondary" to="/requirements">
        Back
      </Link>
    </>
  );
}
```

## ui/src/pages/ApplicationPage.test.jsx

```jsx
import { it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationPage, { toInput } from "./ApplicationPage";
import { renderWithStore, application } from "../test/helpers";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue([]);
});
it("requires login and restricts reviewers from creating applications", () => {
  renderWithStore(<ApplicationPage />, { user: null });
  expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
});
it("adds and removes engagement entries and posts real form values", async () => {
  request.mockImplementation((path) =>
    Promise.resolve(path === "/applications" ? [] : application),
  );
  const { store } = renderWithStore(<ApplicationPage />);
  await waitFor(() => expect(store.getState().applications.pending).toBe(0));
  fireEvent.change(screen.getByLabelText("Last name:"), {
    target: { value: "Cole" },
  });
  fireEvent.change(screen.getByLabelText("First name:"), {
    target: { value: "Cameron" },
  });
  fireEvent.change(screen.getByLabelText("DOB:"), {
    target: { value: "2000-01-01" },
  });
  fireEvent.change(screen.getByLabelText("SSN:"), {
    target: { value: "123-45-6789" },
  });
  fireEvent.change(screen.getByLabelText("Name of Employer"), {
    target: { value: "Employer" },
  });
  fireEvent.change(screen.getByLabelText("EID"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText("Number of hours this month"), {
    target: { value: "80" },
  });
  fireEvent.change(screen.getByLabelText("Monthly income (pre-tax):"), {
    target: { value: "740" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Add another engagement type" }),
  );
  expect(screen.getAllByLabelText("Engagement type")).toHaveLength(2);
  await userEvent.click(
    screen.getByRole("button", { name: "Remove engagement 2" }),
  );
  expect(screen.getAllByLabelText("Engagement type")).toHaveLength(1);
  request.mockImplementation((path, options) =>
    Promise.resolve(options?.method === "POST" ? application : []),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Save application" }),
  );
  await screen.findByText(
    "Application saved. Upload supporting documents, then submit.",
  );
  expect(request).toHaveBeenCalledWith(
    "/applications",
    expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({
        firstName: "Cameron",
        ssn: "123-45-6789",
        monthlyIncome: 740,
      }),
    }),
  );
  expect(
    screen.getByRole("button", { name: "Submit application" }),
  ).toBeDisabled();
});
it("shows returned notes and enables submission after saved documents exist", async () => {
  const a = {
    ...application,
    status: "RETURNED",
    reviewNote: "Correct the income",
    documents: [
      { id: "d1", filename: "proof.pdf", uploadedAt: "2026-01-01T00:00:00Z" },
    ],
  };
  request.mockImplementation((path) =>
    Promise.resolve(
      path === "/applications" ? [a] : { ...a, status: "SUBMITTED" },
    ),
  );
  renderWithStore(<ApplicationPage />, {
    state: {
      applications: {
        items: [a],
        current: a,
        history: [],
        pending: 0,
        error: null,
        fields: {},
      },
    },
  });
  expect(screen.getByText(/Correct the income/)).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Submit application" }),
    ).toBeEnabled(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Submit application" }),
  );
  await screen.findByText("Application submitted for employee review.");
  expect(
    screen.queryByRole("button", { name: "Save application" }),
  ).not.toBeInTheDocument();
});
it("converts numbers and optional education hours for the API", () => {
  expect(
    toInput({
      monthlyIncome: "740.50",
      engagements: [{ type: "EDUCATION", hours: "", attendance: "HALF_TIME" }],
    }),
  ).toMatchObject({
    monthlyIncome: 740.5,
    engagements: [{ hours: 0, attendance: "HALF_TIME" }],
  });
});

it("allows an explanation instead of invented activity records", async () => {
  renderWithStore(<ApplicationPage />);
  await userEvent.click(
    screen.getByLabelText(
      "I am reporting a covered reason instead of activities",
    ),
  );
  expect(screen.queryByLabelText("Name of Employer")).not.toBeInTheDocument();
  expect(
    screen.getByLabelText("Covered reason or explanation"),
  ).toBeRequired();
});
```

## ui/src/pages/RequirementsPage.jsx

```jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { loadRequirements } from "../features/requirementsSlice";
export default function RequirementsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, status, error } = useSelector((s) => s.requirements);
  const [showReasons, setShowReasons] = useState(false);
  useEffect(() => {
    if (status === "idle") dispatch(loadRequirements());
  }, [dispatch, status]);
  return (
    <div className="requirements-page">
      <h2>Medicaid Employment Requirements</h2>
      <p>
        Learn about the requirements and what information you may need to
        provide to maintain your Medicaid coverage.
      </p>
      {status === "loading" && <p role="status">Loading requirements…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => dispatch(loadRequirements())}>
            Try again
          </button>
        </div>
      )}
      {data && (
        <>
          <section className="information-box">
            <h3>WHAT YOU NEED TO KNOW</h3>
            <p>{data.intro}</p>
            <ul className="category-grid">
              {data.categories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
          </section>
          <section className="information-box">
            <h3>You May Qualify for a Covered Reason</h3>
            <p>{data.coveredReasons}</p>
            <button
              onClick={() => setShowReasons(!showReasons)}
              aria-expanded={showReasons}
              aria-controls="covered-reasons"
            >
              View Covered Reasons
            </button>
            {showReasons && (
              <div id="covered-reasons">
                <p>
                  Staff can review whether a covered reason applies to your
                  situation. You can add an explanation and supporting documents
                  to your application.
                </p>
                <a href={data.guidanceUrl} target="_blank" rel="noreferrer">
                  Read current official Medicaid guidance
                </a>
              </div>
            )}
          </section>
        </>
      )}
      <div className="button-row">
        <button
          type="button"
          className="secondary"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <Link className="button" to="/application">
          Continue
        </Link>
      </div>
    </div>
  );
}
```

## ui/src/pages/RequirementsPage.test.jsx

```jsx
import { it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequirementsPage from "./RequirementsPage";
import { renderWithStore } from "../test/helpers";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
it("loads requirements and expands covered reasons without a fourth page", async () => {
  request.mockResolvedValue({
    intro: "Report your activities.",
    categories: ["Employment", "Education"],
    coveredReasons: "Staff will review covered reasons.",
    guidanceUrl: "https://www.medicaid.gov/renew-info",
  });
  renderWithStore(<RequirementsPage />);
  await screen.findByText("Report your activities.");
  await userEvent.click(
    screen.getByRole("button", { name: "View Covered Reasons" }),
  );
  expect(
    screen.getByRole("link", {
      name: "Read current official Medicaid guidance",
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
    "href",
    "/application",
  );
});
```

## ui/src/pages/ReviewPage.jsx

```jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loadApplications,
  loadApplication,
  loadHistory,
  recordDecision,
  clearCurrent,
} from "../features/applicationSlice";
import SignIn from "../components/SignIn";
import ApplicationSummary, { readable } from "../components/ApplicationSummary";
import DocumentUpload from "../components/DocumentUpload";
export default function ReviewPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.session.user);
  const { items, current, history, pending, error } = useSelector(
    (s) => s.applications,
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (user?.role === "REVIEWER") {
      dispatch(clearCurrent());
      dispatch(loadApplications());
    }
  }, [dispatch, user]);
  useEffect(() => {
    setNote("");
    if (current) dispatch(loadHistory(current.id));
  }, [dispatch, current]);
  async function decide(decision) {
    setMessage("");
    const action = await dispatch(
      recordDecision({
        id: current.id,
        version: current.version,
        decision,
        note,
      }),
    );
    if (recordDecision.fulfilled.match(action))
      setMessage("Review decision saved.");
  }
  if (!user) return <SignIn />;
  if (user.role !== "REVIEWER")
    return (
      <section className="card">
        <h2>Employee access required</h2>
        <p>
          Sign out and sign in with an employee account to review submissions.
        </p>
      </section>
    );
  const reviewable =
    current && ["SUBMITTED", "FURTHER_REVIEW"].includes(current.status);
  return (
    <>
      <section className="card">
        <h2>Employee Review</h2>
        <button
          className="secondary"
          disabled={pending > 0}
          onClick={() => {
            dispatch(clearCurrent());
            setMessage("");
            dispatch(loadApplications());
          }}
        >
          Refresh applications
        </button>
        <label htmlFor="review-application">Select an application</label>
        <select
          id="review-application"
          value={current?.id || ""}
          disabled={pending > 0}
          onChange={(e) => {
            setMessage("");
            e.target.value
              ? dispatch(loadApplication(e.target.value))
              : dispatch(clearCurrent());
          }}
        >
          <option value="">Choose an application</option>
          {items.map((a) => (
            <option value={a.id} key={a.id}>
              {a.firstName} {a.lastName} · {a.reportingMonth} ·{" "}
              {readable(a.status)}
            </option>
          ))}
        </select>
        {items.length === 0 && pending === 0 && (
          <p>No submitted applications yet.</p>
        )}
        {current && (
          <p>
            <strong>Status:</strong> {readable(current.status)}
          </p>
        )}
      </section>
      {pending > 0 && <p role="status">Working…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {current && (
        <>
          <ApplicationSummary application={current} />
          <DocumentUpload application={current} />
          <section className="card final-decision">
            <label htmlFor="review-note">Review note</label>
            <textarea
              id="review-note"
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!reviewable || pending > 0}
            />
            <p className="hint">
              Include a note for corrections or further review.
            </p>
            <div className="decision-buttons">
              <button
                disabled={!reviewable || pending > 0}
                onClick={() => decide("APPROVE")}
              >
                Approve &amp; Submit
              </button>
              <button
                disabled={!reviewable || pending > 0 || !note.trim()}
                onClick={() => decide("FURTHER_REVIEW")}
              >
                Send for Further Review
              </button>
              <button
                disabled={!reviewable || pending > 0 || !note.trim()}
                onClick={() => decide("RETURN")}
              >
                Return for Correction
              </button>
            </div>
          </section>
          <section className="card">
            <h2>Review History</h2>
            {history.length === 0 ? (
              <p>No decisions recorded yet.</p>
            ) : (
              <ul>
                {history.map((event) => (
                  <li key={event.id}>
                    {readable(event.decision)} · {event.reviewer} ·{" "}
                    {new Date(event.at).toLocaleString()}
                    {event.note && <p>{event.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
```

## ui/src/pages/ReviewPage.test.jsx

```jsx
import { it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewPage from "./ReviewPage";
import { renderWithStore, application } from "../test/helpers";
import { request } from "../api/client";
vi.mock("../api/client", () => ({ request: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("restricts employee controls to reviewers", () => {
  renderWithStore(<ReviewPage />);
  expect(screen.getByText("Employee access required")).toBeInTheDocument();
  expect(screen.queryByText("Approve & Submit")).not.toBeInTheDocument();
});
it("loads actual submissions and sends a versioned review decision with a required note", async () => {
  const a = { ...application, status: "SUBMITTED" };
  request.mockImplementation((path, options) =>
    Promise.resolve(
      path === "/applications"
        ? [a]
        : path.endsWith("/history")
          ? []
          : options?.method === "POST"
            ? { ...a, status: "RETURNED", version: 1 }
            : a,
    ),
  );
  renderWithStore(<ReviewPage />, {
    user: { username: "reviewer", role: "REVIEWER" },
  });
  await screen.findByRole("option", { name: /Cameron Cole/ });
  await userEvent.selectOptions(
    screen.getByLabelText("Select an application"),
    "a1",
  );
  await screen.findByText("***-**-6789");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Approve & Submit" }),
    ).toBeEnabled(),
  );
  expect(
    screen.getByRole("button", { name: "Return for Correction" }),
  ).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("Review note"),
    "Please correct the income.",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Return for Correction" }),
  );
  await screen.findByText("Review decision saved.");
  expect(request).toHaveBeenCalledWith("/applications/a1/decision?version=0", {
    method: "POST",
    body: { decision: "RETURN", note: "Please correct the income." },
  });
  expect(
    screen.getByRole("button", { name: "Approve & Submit" }),
  ).toBeDisabled();
});
```

## ui/src/styles.scss

```scss
$primary: #4f7ac4;
$panel: #c9ddff;
* {
  box-sizing: border-box;
}
body {
  font-family: Arial, sans-serif;
  margin: 0;
  color: #333;
  background: #f4f6f8;
}
.header,
.navigation,
.account,
main,
footer {
  width: min(100% - 32px, 900px);
  margin-inline: auto;
}
.header {
  margin-top: 32px;
  background: $primary;
  color: white;
  padding: 25px;
  text-align: center;
  h1 {
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    line-height: 1.2;
    margin: 20px 0 25px;
  }
}
.navigation {
  background: $panel;
  padding: 15px 18px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid #7f8ea5;
  div {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  a {
    color: #203657;
  }
  a.active {
    font-weight: bold;
    text-decoration-thickness: 2px;
  }
}
.account {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding-block: 12px;
  font-size: 0.9rem;
}
main {
  padding-top: 24px;
  min-height: 60vh;
}
.card {
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 32px;
  h2 {
    margin-top: 0;
    font-size: 1.85rem;
  }
}
label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
}
input,
select,
textarea {
  width: 100%;
  padding: 10px;
  margin-bottom: 18px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font: inherit;
  background: white;
  color: #222;
}
textarea {
  min-height: 100px;
  resize: vertical;
}
input:focus,
select:focus,
textarea:focus {
  outline: 2px solid $primary;
  outline-offset: 2px;
}
button,
.button {
  display: inline-block;
  padding: 10px 20px;
  background: $primary;
  color: white;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  font: inherit;
  text-decoration: none;
  text-align: center;
  &:hover {
    background: #357abd;
  }
  &:focus-visible {
    outline: 3px solid #182a49;
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
.secondary {
  background: white;
  color: #315687;
  border-color: $primary;
  &:hover {
    background: #e6efff;
  }
}
.text-button {
  text-align: left;
  background: white;
  color: #315687;
  text-decoration: underline;
  padding: 8px 0;
  &:hover {
    background: #edf3ff;
  }
}
.button-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}
.form-fieldset {
  border: 0;
  padding: 0;
  margin: 0;
}
.engagement {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #b5c6df;
  border-radius: 6px;
  legend {
    font-weight: bold;
  }
}
.field {
  margin-bottom: 16px;
}
.field input {
  margin-bottom: 6px;
}
.field-error,
[role="alert"],
.error {
  color: #a12020;
}
.error {
  background: #fff0f0;
  padding: 16px;
  margin-bottom: 20px;
}
.hint,
.muted,
.personal-info dd {
  color: #606060;
}
.hint {
  font-size: 0.9rem;
  line-height: 1.5;
}
.table-scroll {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  text-align: left;
}
th,
td {
  border: 2px solid gray;
  padding: 12px;
  overflow-wrap: anywhere;
}
.personal-info {
  dt {
    font-weight: bold;
    margin-top: 20px;
  }
  dd {
    margin: 10px 0 35px;
  }
}
.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.documents {
  background: $panel;
  fieldset {
    border: 1px solid #839ac0;
    padding: 18px;
  }
}
.document-list,
.application-list {
  list-style: none;
  padding: 0;
}
.document-list li {
  background: white;
  padding: 16px;
  margin: 14px 0;
  overflow-wrap: anywhere;
}
.final-decision {
  text-align: center;
}
.decision-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.requirements-page {
  width: min(100%, 460px);
  margin-inline: auto;
  h2 {
    text-align: center;
    font-size: 1.35rem;
  }
  p {
    font-size: 0.95rem;
    line-height: 1.5;
  }
}
.information-box {
  background: $panel;
  border: 2px solid #5c6572;
  padding: 20px;
  text-align: center;
  margin-bottom: 24px;
  h3 {
    font-size: 1rem;
    margin-top: 0;
  }
}
.category-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 35px 20px;
  list-style: none;
  padding: 22px 0 10px;
  text-align: left;
  font-weight: bold;
  font-size: 0.9rem;
}
footer {
  text-align: center;
  font-size: 0.8rem;
  color: #666;
  padding: 40px 0 20px;
}
.sign-in {
  max-width: 500px;
  margin-inline: auto;
}
@media (max-width: 600px) {
  .header {
    margin-top: 16px;
    padding: 18px;
  }
  .card {
    padding: 22px;
    h2 {
      font-size: 1.5rem;
    }
  }
  .navigation,
  .account {
    flex-direction: column;
    align-items: flex-start;
  }
  .two-columns {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .category-grid {
    gap: 24px 16px;
  }
  th,
  td {
    padding: 9px;
  }
}

.covered-choice {
  display: flex;
  align-items: center;
  gap: 10px;
  input {
    width: auto;
    margin: 0;
    flex-shrink: 0;
  }
}
```

## ui/src/test/helpers.jsx

```jsx
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { makeStore } from "../app/store";
export const application = {
  id: "a1",
  version: 0,
  status: "DRAFT",
  firstName: "Cameron",
  lastName: "Cole",
  middleInitial: "C",
  dob: "2000-01-01",
  ssnMasked: "***-**-6789",
  monthlyIncome: 740,
  reportingMonth: "2026-01",
  coveredReason: "",
  totalHours: 80,
  engagements: [
    {
      type: "EMPLOYMENT",
      name: "Employer",
      organizationId: "123",
      hours: 80,
      program: "",
      attendance: null,
    },
  ],
  documents: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
export function renderWithStore(
  element,
  {
    user = { username: "applicant", role: "APPLICANT" },
    state = {},
    route = "/application",
  } = {},
) {
  const store = makeStore({
    session: { user, status: "ready", error: null },
    ...state,
  });
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
      </Provider>,
    ),
    store,
  };
}
```

## ui/src/test/setup.js

```javascript
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
```

## ui/vite.config.js

```javascript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Tree shaking stalled with this dependency graph; this keeps builds reliable.
  // The resulting JavaScript bundle is about 284 kB before gzip.
  build: { rollupOptions: { treeshake: false } },
  css: { preprocessorMaxWorkers: 0 },
  // Browser requests stay on the UI origin; Vite forwards /api to Java.
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**"],
    },
  },
});
```

