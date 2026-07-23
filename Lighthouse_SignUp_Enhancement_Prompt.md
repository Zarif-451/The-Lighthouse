# Lighthouse -- Sign-Up Enhancement Prompt

## Project: Lighthouse

The application already has a fully functional **Sign-Up** page
connected to authentication.

## IMPORTANT

-   Do **NOT** redesign the existing Sign-Up page.
-   Reuse the current layout, styling, spacing, typography, colors,
    animations, buttons, validation, and overall Lighthouse design
    system.
-   Only extend the existing Sign-Up form by adding the fields described
    below.

------------------------------------------------------------------------

# OBJECTIVE

Enhance the existing Sign-Up interface by introducing additional profile
information using a wider variety of UI components.

The goal is to collect richer user profile information that can later be
used for personalization and behavioural recommendations.

Do **NOT** implement personalization yet.

Only implement the new UI, validation, database storage, and profile
integration.

------------------------------------------------------------------------

# KEEP EXISTING FIELDS

Keep these existing fields exactly as they are:

-   Full Name
-   Email
-   Password
-   Confirm Password
-   Terms & Conditions Checkbox

Do not remove or redesign them.

------------------------------------------------------------------------

# NEW REQUIRED FIELD

## Occupation

**Component:** Dropdown

Options:

-   Student
-   Teacher
-   Employee
-   Freelancer
-   Self-Employed
-   Unemployed
-   Retired
-   Other

### Validation

This field is **REQUIRED**.

If **Other** is selected:

Automatically display a new text field:

> Please specify your occupation

This field becomes **REQUIRED** only when **Other** is selected.

------------------------------------------------------------------------

# NEW REQUIRED FIELD

## Interests

**Component:** Checkbox Group

Allow multiple selections.

Require at least **ONE** interest.

Suggested options:

-   Reading
-   Music
-   Sports
-   Gaming
-   Traveling
-   Coding
-   Meditation
-   Exercise
-   Photography
-   Movies
-   Art
-   Cooking

Store all selected interests.

------------------------------------------------------------------------

# NEW OPTIONAL FIELD

## Phone Number

**Component:** Text Field

-   Optional
-   Validate basic phone number format

------------------------------------------------------------------------

# NEW OPTIONAL FIELD

## Date of Birth

**Component:** Date Picker

-   Optional
-   Future dates must not be allowed

------------------------------------------------------------------------

# NEW OPTIONAL FIELD

## Gender

**Component:** Radio Buttons

Options:

-   Male
-   Female

Only one selection allowed.

------------------------------------------------------------------------

# NEW OPTIONAL FIELD

## Profile Picture

**Component:** Image Upload

Allow:

-   JPG
-   PNG
-   WEBP

Display image preview after selection.

------------------------------------------------------------------------

# NEW OPTIONAL FIELD

## How did you hear about Lighthouse?

**Component:** Dropdown

Options:

-   Friend
-   University
-   Social Media
-   Google Search
-   Advertisement
-   Other

------------------------------------------------------------------------

# NEW OPTIONAL FIELD

## Short Bio

**Component:** Multi-line Text Area

Maximum:

**250 characters**

Display a live character counter.

------------------------------------------------------------------------

# DATABASE

Store all new profile information.

Create or update the appropriate user profile table.

Suggested fields:

-   phone_number
-   date_of_birth
-   gender
-   occupation
-   custom_occupation
-   interests
-   profile_picture_url
-   heard_about
-   short_bio
-   created_at
-   updated_at

Authentication must continue working exactly as before.

------------------------------------------------------------------------

# VALIDATION

Validate:

-   Required fields
-   Email format
-   Password confirmation
-   Occupation required
-   Custom occupation required when "Other" is selected
-   At least one Interest selected
-   Maximum Bio length
-   Valid phone number
-   No future birth dates

Display friendly validation messages.

------------------------------------------------------------------------

# USER EXPERIENCE

Maintain the existing Lighthouse appearance.

-   Do not overcrowd the page.
-   Use proper spacing.
-   Keep the form responsive.
-   Ensure accessibility.
-   Show loading indicators while creating the account.
-   Show success and error notifications.

------------------------------------------------------------------------

# IMPORTANT

This prompt only extends the Sign-Up page.

Do **NOT**:

-   Build personalized recommendations
-   Build behavioural analysis
-   Modify Dashboard functionality
-   Redesign any existing page

------------------------------------------------------------------------

# DELIVERABLES

After implementation provide:

1.  Summary of changes.
2.  Files modified.
3.  Database schema updates.
4.  Validation rules.
5.  New profile fields stored.
6.  Confirm authentication still works.
7.  Confirm all new fields are correctly saved.
8.  Confirm the existing Lighthouse UI has been preserved.
