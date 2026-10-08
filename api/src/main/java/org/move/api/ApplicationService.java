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
