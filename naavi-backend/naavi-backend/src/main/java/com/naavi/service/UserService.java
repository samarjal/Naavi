package com.naavi.service;

import com.naavi.dto.Dto.UpdateUserRequest;
import com.naavi.entity.User;
import com.naavi.exception.NotFoundException;
import com.naavi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository users;

    @Transactional(readOnly = true)
    public User get(Long userId) {
        return users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
    }

    @Transactional
    public User update(Long userId, UpdateUserRequest r) {
        User u = get(userId);
        if (r.name() != null && !r.name().isBlank()) u.setName(r.name().trim());
        if (r.phone() != null) u.setPhone(r.phone().isBlank() ? null : r.phone().trim());
        if (r.profilePictureUrl() != null) {
            u.setProfilePictureUrl(r.profilePictureUrl().isBlank() ? null : r.profilePictureUrl().trim());
        }
        return users.save(u);
    }
}
