package com.barbershop.repository;

import com.barbershop.entity.AdminMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminMessageRepository extends JpaRepository<AdminMessage, Long> {
    List<AdminMessage> findAllByOrderByTimestampAsc();
}
