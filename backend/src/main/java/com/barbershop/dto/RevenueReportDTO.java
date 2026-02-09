package com.barbershop.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RevenueReportDTO {
    private Long barberId;
    private String barberName;
    private List<DailyRevenueDTO> dailyRevenues;
    private List<WeeklyRevenueDTO> weeklyRevenues;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyRevenueDTO {
        private String date;
        private List<RevenueDetailDTO> details;
        private Double totalRevenue;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeeklyRevenueDTO {
        private Integer weekNumber;
        private Integer year;
        private String weekRange; // e.g., "09 Feb - 15 Feb"
        private List<RevenueDetailDTO> details;
        private Double totalRevenue;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevenueDetailDTO {
        private Long appointmentId;
        private String clientName;
        private String services;
        private Double price;
        private String date;
    }
}
