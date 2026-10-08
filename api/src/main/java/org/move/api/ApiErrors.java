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
