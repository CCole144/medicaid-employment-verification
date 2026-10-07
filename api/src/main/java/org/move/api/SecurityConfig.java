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
