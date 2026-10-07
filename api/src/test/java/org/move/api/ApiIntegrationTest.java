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
