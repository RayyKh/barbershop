package com.barbershop.repository;

import com.barbershop.entity.Barber;
import com.barbershop.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BarberRepository extends JpaRepository<Barber, Long> {
    Optional<Barber> findByUser(User user);
}
