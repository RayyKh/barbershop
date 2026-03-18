package com.barbershop;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

import jakarta.annotation.PostConstruct;

@SpringBootApplication
@EnableAsync
public class BarbershopApplication {

	static {
		TimeZone.setDefault(TimeZone.getTimeZone("Africa/Tunis"));
		System.setProperty("user.timezone", "Africa/Tunis");
	}

	@PostConstruct
	public void init() {
		TimeZone.setDefault(TimeZone.getTimeZone("Africa/Tunis"));
	}

	public static void main(String[] args) {
		SpringApplication.run(BarbershopApplication.class, args);
	}

}
