package com.barbershop.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Autowired
    UserDetailsServiceImpl userDetailsService;

    @Bean
    public AuthTokenFilter authenticationJwtTokenFilter() {
        return new AuthTokenFilter();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
   
        return authProvider;
    }
    
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> 
                auth.requestMatchers("/api/auth/**").permitAll()
                    .requestMatchers("/api/appointments/available").permitAll()
                    .requestMatchers("/api/appointments/book").permitAll()
                    .requestMatchers("/api/appointments/by-contact").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/services/**").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/barbers/**").permitAll()
                    .requestMatchers("/api/products/**").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/appointments/*/cancel").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/appointments/*/modify").permitAll()
                    .requestMatchers("/h2-console/**").permitAll()
                    // All other admin endpoints
                    .requestMatchers("/api/appointments/revenue-report/**").hasRole("ADMIN")
                    .requestMatchers("/api/appointments/blocked", "/api/appointments/blocked/**").hasRole("ADMIN")
                    .requestMatchers("/api/appointments/new-count").hasRole("ADMIN")
                    .requestMatchers("/api/appointments/*/view").hasRole("ADMIN")
                    .requestMatchers("/api/appointments/stream").hasRole("ADMIN")
                    .requestMatchers("/api/appointments", "/api/appointments/**").hasRole("ADMIN")
                    .requestMatchers("/api/services/**").hasRole("ADMIN")
                    .requestMatchers("/api/barbers/**").hasRole("ADMIN")
                    .requestMatchers("/api/products/**").hasRole("ADMIN")
                    .anyRequest().authenticated()
            );
        
        // fix H2 console
        http.headers(headers -> headers.frameOptions(frameOption -> frameOption.sameOrigin()));
        
        http.authenticationProvider(authenticationProvider());

        http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
    
    @Bean
    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList("*")); // Plus permissif pour le debug
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
        configuration.setExposedHeaders(Arrays.asList("Authorization"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
