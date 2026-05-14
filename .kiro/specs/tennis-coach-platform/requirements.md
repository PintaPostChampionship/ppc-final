# Requirements Document

## Introduction

Tennis Coach Platform is an independent web platform that connects tennis coaches with students. Coaches create profiles, manage their schedules, set pricing, and accept bookings. Students discover coaches by location, book classes, and pay through the platform. The platform operates as both a coach's personal booking page (shareable link) and a marketplace for students to find coaches nearby.

The MVP prioritizes the coach experience (profile, calendar, booking management, payment configuration) while providing a functional student-facing side (search, view profiles, book classes). The platform launches in London with architecture designed for expansion to other cities and countries.

## Glossary

- **Platform**: The tennis-coach-platform web application
- **Coach**: A registered user with the coach role who offers tennis classes
- **Student**: A registered user with the student role who books tennis classes
- **Class**: A scheduled tennis session offered by a coach (individual or group)
- **Individual_Class**: A one-on-one session between a coach and a single student
- **Group_Class**: A session where multiple students participate (drills, clinics, mini-tournaments, social events)
- **Booking**: A reservation made by a student for a specific class
- **Calendar**: The coach's schedule showing available slots, blocked times, and booked classes
- **Coach_Page**: The public-facing profile page for a coach, accessible via a shareable URL
- **Slot**: A time block in the coach's calendar that can be available, booked, or blocked
- **Class_Pack**: A bundle of pre-paid classes offered at a discount (e.g., 4 classes with 20% off)
- **Subscription_Plan**: The recurring payment plan a coach pays to use the platform (monthly, quarterly, or annual)
- **Notification_Service**: The system responsible for sending push notifications and emails to users
- **Search_Engine**: The component that allows students to find coaches by location, name, zone, or price

## Requirements

### Requirement 1: Coach Registration and Profile Creation

**User Story:** As a tennis coach, I want to register on the platform and have my profile created automatically, so that I can start offering classes quickly.

#### Acceptance Criteria

1. WHEN a user selects the "I want to be a coach" option during registration, THE Platform SHALL require the user to provide a name (1–100 characters), email, and password, and SHALL create a Coach account with a public profile where all optional fields (photo, location, experience, qualifications, pricing, available class types) are initially empty and visible
2. WHEN a Coach account is created, THE Platform SHALL generate a unique shareable URL in the format `{domain}/coach/{coach-slug}`, where the coach-slug is derived from the coach's name (lowercased, spaces replaced with hyphens, 3–60 characters), appending a numeric suffix if the slug already exists
3. THE Coach_Page SHALL display the coach's name and any optional fields (photo, location, experience, qualifications, pricing, available class types) that have been populated and are set to visible, omitting sections for fields that are empty or hidden
4. WHEN a Coach edits their profile, THE Platform SHALL update the Coach_Page within 5 seconds
5. THE Platform SHALL allow a Coach to toggle visibility of individual profile fields (experience, qualifications, photo, pricing), with all toggleable fields defaulting to visible upon account creation
6. IF a Coach attempts to register with an email already associated with an existing account, THEN THE Platform SHALL display an error message indicating the email is already in use and offer options to log in to the existing account or add the Coach role to the existing account
7. IF a visitor navigates to a coach-slug URL that does not correspond to any existing Coach account, THEN THE Platform SHALL display an error message indicating the profile was not found

### Requirement 2: Student Registration and Profile

**User Story:** As a tennis student, I want to register on the platform and create my profile, so that I can search for coaches and book classes.

#### Acceptance Criteria

1. WHEN a user selects the "I want to be a student" option during registration, THE Platform SHALL require the user to provide a name (1–100 characters), email, and password, and SHALL create a Student account with a basic profile
2. THE Platform SHALL store the Student's name, email, location (postcode between 5–8 characters or area name up to 100 characters), and notification preferences (defaulting to push notifications enabled for all types)
3. WHEN a Student completes registration, THE Platform SHALL present the search/discovery interface as the default view within 3 seconds of account creation
4. THE Platform SHALL allow a user to hold both Coach and Student roles on the same account, switchable from the user settings without re-registration
5. IF a Student attempts to register with an email already associated with an existing account, THEN THE Platform SHALL display an error message indicating the email is already in use and offer options to log in or add the Student role to the existing account
6. IF registration fails due to a server error, THEN THE Platform SHALL display a generic error message and retain the user's entered data in the form fields

### Requirement 3: Coach Calendar and Schedule Management

**User Story:** As a coach, I want to build and manage my weekly schedule, so that students can see when I'm available and book classes.

#### Acceptance Criteria

1. THE Calendar SHALL display the coach's schedule in a weekly view with daily time slots ranging from 06:00 to 22:00
2. WHEN a Coach creates an available slot, THE Calendar SHALL mark that time as bookable for students, accepting slot durations between 30 minutes and 4 hours in 30-minute increments
3. WHEN a Coach blocks a time slot that has no existing booking, THE Calendar SHALL remove that slot from the public-facing availability
4. IF a Coach attempts to block a time slot that already has a confirmed booking, THEN THE Platform SHALL reject the block and display an error message indicating the slot has an active booking that must be cancelled first
5. WHILE a Coach has a recurring class, WHEN the Coach releases a single occurrence, THE Platform SHALL remove only that occurrence from the schedule and keep all other occurrences unchanged
6. WHEN a Coach releases a recurring slot, THE Platform SHALL offer the option to notify enrolled students that a spot has opened, and deliver the notification within 5 minutes of confirmation
7. THE Calendar SHALL automatically update to reflect new bookings, cancellations, and blocked times within 30 seconds without manual refresh
8. THE Platform SHALL provide an option to export calendar events in iCal format for syncing with external calendars (Google Calendar, Apple Calendar), including all events from the current date forward

### Requirement 4: Class Creation and Configuration

**User Story:** As a coach, I want to create different types of classes with specific settings, so that I can offer varied training options to students.

#### Acceptance Criteria

1. THE Platform SHALL support the following class types: Individual_Class, Group_Class (drill), Group_Class (mini-tournament), Group_Class (social event)
2. WHEN a Coach creates a class, THE Platform SHALL require: title (maximum 100 characters), type, date, start time, duration (30 to 240 minutes in 15-minute increments), price (0.00 to 9999.99 in the platform currency), and maximum capacity (1 for Individual_Class, 2 to 50 for Group_Class)
3. WHEN a Coach creates a Group_Class, THE Platform SHALL allow setting a minimum number of participants (between 1 and the maximum capacity) required for the class to run
4. THE Platform SHALL allow a Coach to set different prices for Individual_Class and Group_Class
5. WHEN a Coach creates a recurring class, THE Platform SHALL require a recurrence pattern (weekly on selected days) and a schedule end date (no more than 12 weeks from the start date), and SHALL generate all individual class occurrences within that date range
6. THE Platform SHALL display the number of available spots remaining for each Group_Class on the Coach_Page
7. IF a Coach submits a class creation form with any required field missing or outside its valid range, THEN THE Platform SHALL reject the submission and indicate which fields require correction
8. IF the number of confirmed participants in a Group_Class is below the minimum number of participants at 24 hours before the class start time, THEN THE Platform SHALL mark the class as at risk of cancellation and notify the Coach

### Requirement 5: Booking Management

**User Story:** As a coach, I want to manage booking requests from students, so that I can control my schedule and approve or reject bookings.

#### Acceptance Criteria

1. THE Platform SHALL support two booking modes per Coach: auto-accept and manual approval, configurable from the Coach dashboard
2. WHEN a Coach has auto-accept enabled and a Student books a class, THE Platform SHALL confirm the booking immediately and notify both parties within 60 seconds
3. WHEN a Coach has manual approval enabled and a Student requests a booking, THE Platform SHALL place the booking in a "pending" state and notify the Coach within 60 seconds
4. WHEN a Coach approves a pending booking, THE Platform SHALL update the booking status to "confirmed" and notify the Student within 60 seconds
5. WHEN a Coach rejects a pending booking, THE Platform SHALL update the booking status to "rejected" and notify the Student within 60 seconds
6. IF a pending booking is not approved or rejected by the Coach within 48 hours, THEN THE Platform SHALL automatically expire the booking and notify the Student
7. WHEN a Student cancels a confirmed booking at least 24 hours before the class start time, THE Platform SHALL free the slot and notify the Coach
8. IF a Student attempts to cancel a confirmed booking less than 24 hours before the class start time, THEN THE Platform SHALL prevent the cancellation and display a message indicating the cancellation window has passed
9. IF a Coach cancels a confirmed class, THEN THE Platform SHALL notify all affected Students, free their bookings, and restore any Class_Pack credits used

### Requirement 6: Pricing and Payment Configuration

**User Story:** As a coach, I want to set my prices and configure how students pay me, so that I can manage my income flexibly.

#### Acceptance Criteria

1. THE Platform SHALL allow a Coach to set a price between 0.00 and 9999.99 (in the coach's configured currency) per class type (individual, group drill, mini-tournament, social event)
2. THE Platform SHALL support the following payment methods configured by the Coach: bank transfer details, payment link (maximum 2048 characters, e.g., PayPal.me, Revolut), and card payment, requiring at least one active payment method before the Coach can publish classes
3. WHEN a Coach configures bank transfer, THE Platform SHALL store and display the coach's bank account holder name, account number, and sort code (or IBAN for international) to students upon booking confirmation
4. THE Platform SHALL support pre-class payment as the default payment timing, with an option for the Coach to enable post-class payment
5. THE Platform SHALL allow a Coach to create up to 20 active Class_Packs, each specifying a number of classes (between 2 and 50) and a discount percentage (between 1% and 100%) that Students can purchase
6. WHEN a Student purchases a Class_Pack, THE Platform SHALL track the remaining classes in the pack and deduct one per booking
7. IF a Student's Class_Pack has zero remaining classes, THEN THE Platform SHALL prevent the Student from booking using that pack and display a notification indicating the pack is fully used
8. IF a Student cancels a booking that was paid using a Class_Pack, THEN THE Platform SHALL restore one class to the Student's remaining pack balance
9. THE Platform SHALL display the selected payment method and coach-provided payment instructions (maximum 500 characters) to the Student at the time of booking confirmation

### Requirement 7: Student Search and Discovery

**User Story:** As a student, I want to search for tennis coaches and classes near me, so that I can find the right coach and book a class.

#### Acceptance Criteria

1. THE Search_Engine SHALL allow Students to search for coaches by location using a postcode, area name, or city zone, returning results within a maximum radius of 25 miles from the specified location
2. THE Search_Engine SHALL allow Students to filter results by: price range (£0.01 to £500.00 per session), class type, availability (day/time), and coach name (minimum 2 characters)
3. WHEN a Student searches by location, THE Search_Engine SHALL return a maximum of 50 coaches sorted by distance in miles from the Student's specified location
4. THE Platform SHALL display each coach search result with: name, photo, location (area and distance from search point), price range (minimum and maximum session price in GBP), rating (1.0 to 5.0 scale), and next available slot (date and time)
5. WHEN a Student selects a coach from search results, THE Platform SHALL navigate to that coach's Coach_Page
6. THE Search_Engine SHALL allow Students to search for specific Group_Classes (drills, mini-tournaments, social events) across all coaches within the specified location radius
7. IF a search returns no matching coaches or classes, THEN THE Platform SHALL display a message indicating no results were found and suggest broadening the search filters or increasing the search radius
8. IF a Student enters a location that cannot be resolved to a geographic position, THEN THE Search_Engine SHALL display a message indicating the location is not recognised and prompt the Student to enter a valid postcode or area name

### Requirement 8: Student Booking Flow

**User Story:** As a student, I want to book a class with a coach, so that I can attend tennis training.

#### Acceptance Criteria

1. WHEN a Student views a Coach_Page, THE Platform SHALL display available slots showing for each slot: class type, date, time, duration, price, and remaining spots
2. WHEN a Student selects a class and confirms booking, THE Platform SHALL create the booking with a status of "pending" (if Coach uses manual approval) or "confirmed" (if Coach uses auto-accept), and display the Coach's configured payment method with the amount due
3. WHEN a booking is confirmed (auto-accept) or approved (manual), THE Platform SHALL send a confirmation notification to the Student within 60 seconds, including class date, time, location, and payment method with amount
4. THE Platform SHALL allow a Student to view all their upcoming and past bookings in a "My Bookings" section, sorted with upcoming bookings by date ascending and past bookings by date descending
5. WHEN a Student has an active Class_Pack with a Coach, THE Platform SHALL automatically apply one pack credit during booking and display the remaining credit balance to the Student before confirmation
6. IF a Student attempts to book a Group_Class that has reached maximum capacity, THEN THE Platform SHALL prevent the booking and display a message indicating the class is full
7. IF a Coach_Page has no available slots, THEN THE Platform SHALL display a message indicating no classes are currently available
8. WHEN a Student cancels a confirmed booking at least 24 hours before the class start time, THE Platform SHALL update the booking status to "cancelled" and release the spot (or restore the Class_Pack credit if one was used)
9. IF a Student attempts to cancel a booking less than 24 hours before the class start time, THEN THE Platform SHALL prevent the cancellation and display a message indicating the cancellation window has passed

### Requirement 9: Notifications and Alerts

**User Story:** As a user (coach or student), I want to receive timely notifications about bookings, schedule changes, and opportunities, so that I stay informed.

#### Acceptance Criteria

1. THE Notification_Service SHALL support two channels: push notifications (browser/PWA) and email
2. WHEN a new booking is created, THE Notification_Service SHALL send a notification to the Coach containing the Student name, class date, and time slot within 60 seconds of creation; IF the booking requires manual approval, THEN THE Notification_Service SHALL also notify the Student that their booking is pending review
3. WHEN a booking is confirmed or rejected, THE Notification_Service SHALL notify the Student within 60 seconds, including the class name, date, time, and the confirmation or rejection status
4. WHEN a Coach releases a previously blocked slot, THE Notification_Service SHALL prompt the Coach with an option to notify subscribed Students; IF the Coach confirms, THEN THE Notification_Service SHALL send a notification to all Students subscribed to that Coach indicating the newly available slot date and time
5. WHEN 24 hours remain before a scheduled class (with a tolerance of ±15 minutes), THE Notification_Service SHALL send a reminder to both the Coach and the enrolled Student containing the class date, time, and location
6. WHEN a Group_Class has available spots and a Student who has opted in to "available class nearby" alerts has a registered postal code within 5 km of the class venue, THE Notification_Service SHALL send an alert containing the class name, venue, date, time, and available spots count
7. THE Platform SHALL allow each user to configure which notification types they receive and through which channel (push, email, or both); THE Platform SHALL default new users to receiving all notification types via push only
8. IF a push notification delivery fails due to an expired or invalid subscription, THEN THE Notification_Service SHALL retry delivery once via email as a fallback channel, provided the user has a verified email address on file

### Requirement 10: Coach Subscription and Platform Business Model

**User Story:** As the platform operator, I want coaches to subscribe to use the platform, so that the business is sustainable.

#### Acceptance Criteria

1. THE Platform SHALL offer subscription plans for coaches: monthly, quarterly, and annual
2. THE Platform SHALL provide a free trial period of 30 days for new coaches to build their profile and start receiving bookings
3. WHILE a Coach is on a free trial, THE Platform SHALL provide access to the same features available on a paid subscription plan
4. WHEN a Coach's free trial expires, THE Platform SHALL require an active subscription to continue receiving new bookings while honoring any previously confirmed bookings
5. THE Platform SHALL display subscription pricing and plan comparison on the coach registration flow
6. WHILE a Coach has an expired subscription, THE Platform SHALL maintain the Coach_Page as visible but disable new booking creation
7. WHEN a Coach's free trial or subscription is within 7 days of expiring, THE Platform SHALL display a notification on the Coach dashboard indicating the remaining days and a prompt to subscribe or renew

### Requirement 11: Multi-Location and Extensibility

**User Story:** As the platform operator, I want the platform to support multiple cities and countries, so that it can scale beyond London.

#### Acceptance Criteria

1. THE Platform SHALL associate each Coach with one or more service locations, where each location includes at minimum a venue name or area name, a city, a country, and an IANA timezone identifier
2. THE Platform SHALL store location data with the following mandatory fields per location record: city, country, and IANA timezone, enabling the addition of new cities and countries without schema changes
3. WHEN a Student searches for coaches, THE Search_Engine SHALL scope results to the Student's selected city or area, where "area" is defined as a named district or neighbourhood within a city
4. IF a Student has not selected a city or area, THEN THE Search_Engine SHALL prompt the Student to select a location before displaying coach results
5. THE Platform SHALL display all times in the local timezone of the class location, formatted according to the locale conventions of that location's country
6. THE Platform SHALL associate each country with a default currency code (ISO 4217), and display prices in the currency corresponding to the class location's country

### Requirement 12: Platform Performance and User Experience

**User Story:** As a user, I want the platform to be fast and attractive on mobile and desktop, so that I have a smooth experience.

#### Acceptance Criteria

1. THE Platform SHALL achieve a Largest Contentful Paint (LCP) of 3 seconds or less when tested on a simulated 4G mobile connection (150ms RTT, 20 Mbps download)
2. THE Platform SHALL be responsive and mobile-first, rendering all content without horizontal scrolling, with all interactive elements reachable by touch or click, and with text readable without zooming, on viewports from 320px to 1920px width
3. THE Platform SHALL be installable as a Progressive Web App (PWA) on mobile devices, passing the Lighthouse PWA installability audit (valid manifest with icons, registered service worker, served over HTTPS)
4. WHEN a Coach or Student performs an action (booking, editing), THE Platform SHALL provide visual feedback within 500ms in the form of a loading indicator, button state change, or inline confirmation message
5. THE Platform SHALL apply a single shared set of design tokens (color palette, typography scale, spacing scale, and component styles) across all pages, with no page using colors, font sizes, or spacing values outside the defined token set
