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
