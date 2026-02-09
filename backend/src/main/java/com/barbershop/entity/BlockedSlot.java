package com.barbershop.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "blocked_slots")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BlockedSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = true)
    private String startTime; // Format: HH:mm (null if whole day is blocked)

    @Column(nullable = true)
    private String endTime; // Format: HH:mm (null if whole day or single slot is blocked)

    @ManyToOne
    @JoinColumn(name = "barber_id", nullable = true) // null if blocked for all barbers
    private Barber barber;

    private String reason;
}
