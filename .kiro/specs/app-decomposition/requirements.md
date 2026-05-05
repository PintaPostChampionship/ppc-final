# Requirements Document

## Introduction

The PPC Tennis web application (`ppc-final`) has grown into a monolithic single-file architecture where `src/App.tsx` contains approximately 12,445 lines of code. This file houses 14+ TypeScript interfaces, 30+ helper functions, 4 inline sub-components, 70+ `useState` hooks, all Supabase queries, and the complete render logic for every view in the application.

This decomposition extracts types, utility functions, constants, and sub-components into dedicated files following a modular structure. The goal is to improve maintainability, enable future features (multi-tenancy, dark mode, React Router), and reduce cognitive load — all without changing any visible functionality.

The refactor follows an incremental approach: one extraction at a time, with a build verification after each step.

## Glossary

- **App**: The root React component in `src/App.tsx` that orchestrates all views and state
- **Extractor**: The process of moving code from `App.tsx` into a dedicated file with proper imports/exports
- **Build**: The Vite production build (`npm run build`) that compiles TypeScript and bundles the application
- **Type_Module**: A dedicated TypeScript file (`src/types/index.ts`) that exports all shared interfaces and type aliases
- **Utility_Module**: A dedicated TypeScript file in `src/lib/` that exports pure helper functions grouped by domain
- **Constants_Module**: A dedicated TypeScript file (`src/lib/constants.ts`) that exports application-wide constant values
- **Sub_Component**: A React component defined inside `App.tsx` that renders a self-contained UI section (e.g., `PlayerShowcaseCard`, `BracketView`, `NavPlayerSearch`, `NavTournamentsSection`)
- **Component_Module**: A dedicated `.tsx` file in `src/components/` that exports a single extracted sub-component
- **Import_Graph**: The set of `import` statements across all source files that reference symbols from `App.tsx` or newly created modules
- **Visual_Regression**: Any change in the rendered HTML, CSS, or interactive behavior visible to the end user

## Requirements

### Requirement 1: Extract TypeScript Interfaces and Type Aliases

**User Story:** As a developer, I want all shared TypeScript interfaces and type aliases in dedicated type files, so that I can import them from any module without depending on `App.tsx`.

#### Acceptance Criteria

1. THE Extractor SHALL move the following interfaces from `App.tsx` to `src/types/index.ts`: `Profile`, `PlayerCard`, `HistoricPlayer`, `Location`, `AvailabilitySlot`, `Tournament`, `Division`, `Registration`, `Match`, `MatchSet`, `Standings`
2. THE Extractor SHALL move the following type aliases from `App.tsx` to `src/types/index.ts`: `BookingAdmin`, `BookingAccount`, `CourtBookingRequest`, `SocialEvent`, `PendingOnboarding`, `PPCNotif`
3. THE Extractor SHALL add named `export` keywords to every interface and type alias in `src/types/index.ts`
4. WHEN `App.tsx` references any extracted type, THE Extractor SHALL replace the inline definition with an `import` statement from `src/types/index.ts`
5. WHEN any other existing module (e.g., `src/hooks/usePaymentStatus.ts`, `src/components/LiveScoreboard/`) references a type that was previously inferred from `App.tsx` props, THE Extractor SHALL add explicit imports from `src/types/index.ts`
6. THE Build SHALL complete without TypeScript errors after the extraction
7. THE Extractor SHALL preserve the existing `src/types/payment.ts` file unchanged

### Requirement 2: Extract Date Utility Functions

**User Story:** As a developer, I want date-related helper functions in a dedicated utility file, so that date formatting logic is reusable and testable independently.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/lib/dateUtils.ts` containing the following functions: `formatISOToDDMMYYYY`, `parseDDMMYYYYToISO`, `tituloFechaEs`, `isTodayOrFuture`, `parseYMDLocal`, `formatDateLocal`, `dateKey`
2. THE Extractor SHALL export each function as a named export from `src/lib/dateUtils.ts`
3. WHEN `App.tsx` calls any extracted date function, THE Extractor SHALL replace the inline definition with an `import` from `src/lib/dateUtils.ts`
4. THE Extractor SHALL ensure each extracted function is a pure function with no dependency on React state or component-scoped variables
5. THE Build SHALL complete without TypeScript errors after the extraction
6. FOR ALL valid ISO date strings, parsing with `parseYMDLocal` then formatting with `formatDateLocal` SHALL produce a consistent Spanish-locale date string (round-trip property)

### Requirement 3: Extract Player Statistics Utility Functions

**User Story:** As a developer, I want player statistics functions in a dedicated utility file, so that player data calculations are testable and reusable.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/lib/playerUtils.ts` containing the following functions: `getPlayerStatsSummaryAll`, `getLeagueRegistrationsForPlayer`, `getLastLeagueEntryForPlayer`, `getFirstLeagueEntryForPlayer`, `getPrettyLeagueResultForPlayer`, `getDivisionNameByIdLocal`, `getAgeFromBirthDate`
2. THE Extractor SHALL export each function as a named export from `src/lib/playerUtils.ts`
3. WHEN `App.tsx` calls any extracted player function, THE Extractor SHALL replace the inline definition with an `import` from `src/lib/playerUtils.ts`
4. THE Extractor SHALL add necessary type imports from `src/types/index.ts` to `src/lib/playerUtils.ts`
5. THE Extractor SHALL ensure each extracted function receives all required data as parameters and does not reference React state or component-scoped variables
6. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 4: Extract Display Helper Functions

**User Story:** As a developer, I want display formatting functions in a dedicated utility file, so that text and visual formatting logic is centralized.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/lib/displayUtils.ts` containing the following functions: `toTitleCase`, `uiName`, `capitaliseFirst`, `divisionLogoSrc`, `divisionColors`, `divisionIcon`, `tournamentLogoSrc`
2. THE Extractor SHALL export each function as a named export from `src/lib/displayUtils.ts`
3. WHEN `App.tsx` or any extracted component calls any extracted display function, THE Extractor SHALL replace the inline definition with an `import` from `src/lib/displayUtils.ts`
4. THE Extractor SHALL ensure each extracted function is a pure function with no dependency on React state
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 5: Extract Image Helper Functions

**User Story:** As a developer, I want image processing functions in a dedicated utility file, so that avatar and image logic is reusable.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/lib/imageUtils.ts` containing the following functions: `dataURItoBlob`, `dataURLtoFile`, `resizeImage`, `avatarSrc`, `hasExplicitAvatar`
2. THE Extractor SHALL export each function as a named export from `src/lib/imageUtils.ts`
3. WHEN `App.tsx` calls any extracted image function, THE Extractor SHALL replace the inline definition with an `import` from `src/lib/imageUtils.ts`
4. THE `avatarSrc` function SHALL receive the Supabase client as a parameter or import it from `src/lib/supabaseClient.ts`, rather than referencing a component-scoped variable
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 6: Extract Onboarding Helper Functions

**User Story:** As a developer, I want onboarding persistence functions in a dedicated utility file, so that the onboarding flow logic is isolated and testable.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/lib/onboardingUtils.ts` containing the following functions: `compressAvailability`, `decompressAvailability`, `savePending`, `loadPending`, `clearPending`, `migrateLocalToSession`
2. THE Extractor SHALL export each function as a named export from `src/lib/onboardingUtils.ts`
3. THE Extractor SHALL move the `PENDING_KEY` constant to `src/lib/onboardingUtils.ts` as a module-scoped variable (not exported)
4. THE Extractor SHALL move the `PendingOnboarding` type to `src/types/index.ts` and import it in `src/lib/onboardingUtils.ts`
5. WHEN `App.tsx` calls any extracted onboarding function, THE Extractor SHALL replace the inline definition with an `import` from `src/lib/onboardingUtils.ts`
6. THE Build SHALL complete without TypeScript errors after the extraction
7. FOR ALL valid `PendingOnboarding` objects with availability data, compressing with `compressAvailability` then decompressing with `decompressAvailability` SHALL produce an equivalent availability record (round-trip property)

### Requirement 7: Extract Tournament Utility Functions

**User Story:** As a developer, I want tournament classification functions in a dedicated utility file, so that tournament type checks are centralized.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/lib/tournamentUtils.ts` containing the following functions: `isCalibrationTournamentByName`, `isOfficialMatchByTournamentId`
2. THE Extractor SHALL export each function as a named export from `src/lib/tournamentUtils.ts`
3. THE Extractor SHALL add necessary type imports from `src/types/index.ts` to `src/lib/tournamentUtils.ts`
4. WHEN `App.tsx` or any extracted utility module calls any extracted tournament function, THE Extractor SHALL replace the inline definition with an `import` from `src/lib/tournamentUtils.ts`
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 8: Extract Application Constants

**User Story:** As a developer, I want application-wide constants in a dedicated file, so that magic values are centralized and easy to update.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/lib/constants.ts` containing the following constants: `BUSCAR_CLASES_ALLOWED_ID`, `PHOTOS_BASE_PATH`, `highlightPhotos`, `BOOKING_VENUES`
2. THE Extractor SHALL export each constant as a named export from `src/lib/constants.ts`
3. THE Extractor SHALL move the `BookingVenueKey` type alias to `src/types/index.ts`
4. WHEN `App.tsx` references any extracted constant, THE Extractor SHALL replace the inline definition with an `import` from `src/lib/constants.ts`
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 9: Extract PlayerShowcaseCard Component

**User Story:** As a developer, I want the PlayerShowcaseCard component in its own file, so that the player card UI is independently maintainable.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/components/PlayerShowcaseCard.tsx` containing the `PlayerShowcaseCard` component and its props type
2. THE Extractor SHALL add necessary imports from `src/types/index.ts`, `src/lib/displayUtils.ts`, and `src/lib/playerUtils.ts` to the new component file
3. WHEN `App.tsx` renders `PlayerShowcaseCard`, THE Extractor SHALL replace the inline definition with an `import` from `src/components/PlayerShowcaseCard.tsx`
4. THE extracted component SHALL accept the same props interface as the original inline component
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 10: Extract BracketView Component

**User Story:** As a developer, I want the BracketView component and its sub-components in a dedicated file, so that the knockout bracket UI is independently maintainable.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/components/BracketView.tsx` containing the `BracketView`, `BracketPlayerSlot`, and `BracketMatchCard` components along with their props types (`BracketViewProps`, `BracketPlayerSlotProps`, `BracketMatchCardProps`, `BracketAnyPlayer`)
2. THE Extractor SHALL move the `getNextMatchPosition` and `advanceWinner` helper functions to `src/components/BracketView.tsx` as module-scoped functions, since they are only used by the bracket logic
3. THE Extractor SHALL add necessary imports from `src/types/index.ts`, `src/lib/displayUtils.ts`, and `src/lib/supabaseClient.ts` to the new component file
4. WHEN `App.tsx` renders `BracketView`, THE Extractor SHALL replace the inline definition with an `import` from `src/components/BracketView.tsx`
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 11: Extract NavPlayerSearch Component

**User Story:** As a developer, I want the NavPlayerSearch component in its own file, so that the navigation search UI is independently maintainable.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/components/NavPlayerSearch.tsx` containing the `NavPlayerSearch` component and its props type
2. THE Extractor SHALL add necessary imports from `src/types/index.ts` to the new component file
3. WHEN `App.tsx` renders `NavPlayerSearch`, THE Extractor SHALL replace the inline definition with an `import` from `src/components/NavPlayerSearch.tsx`
4. THE extracted component SHALL accept the same props interface as the original inline component
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 12: Extract NavTournamentsSection Component

**User Story:** As a developer, I want the NavTournamentsSection component in its own file, so that the navigation tournaments UI is independently maintainable.

#### Acceptance Criteria

1. THE Extractor SHALL create `src/components/NavTournamentsSection.tsx` containing the `NavTournamentsSection` component and its props type
2. THE Extractor SHALL add necessary imports from `src/types/index.ts` to the new component file
3. WHEN `App.tsx` renders `NavTournamentsSection`, THE Extractor SHALL replace the inline definition with an `import` from `src/components/NavTournamentsSection.tsx`
4. THE extracted component SHALL accept the same props interface as the original inline component
5. THE Build SHALL complete without TypeScript errors after the extraction

### Requirement 13: Update All Import References

**User Story:** As a developer, I want all import statements across the codebase to reference the new module locations, so that the dependency graph is correct and complete.

#### Acceptance Criteria

1. WHEN a symbol is moved from `App.tsx` to a new module, THE Extractor SHALL update every file that imports or references that symbol to use the new module path
2. THE Extractor SHALL verify that no circular imports exist between the newly created modules
3. THE Extractor SHALL verify that `src/lib/supabaseClient.ts` remains the single source of the Supabase client instance
4. THE Build SHALL complete without TypeScript errors after all import updates
5. IF a moved function depends on another moved function (e.g., `getPlayerStatsSummaryAll` depends on `isCalibrationTournamentByName`), THEN THE Extractor SHALL add the appropriate cross-module import in the destination file

### Requirement 14: Zero Visual Regression

**User Story:** As a developer, I want the application to look and behave exactly the same after the refactor, so that users experience no disruption.

#### Acceptance Criteria

1. THE App SHALL render identical HTML output for every view (Home, Tournament Detail, Division Table, Player Profile, Booking Panel, Hall of Fame, Historic Tournaments, Onboarding) after the refactor
2. THE App SHALL preserve all interactive behaviors (navigation, form submissions, modal dialogs, photo carousel, live scoreboard integration) after the refactor
3. THE Extractor SHALL introduce zero new runtime dependencies (no new entries in `package.json`)
4. THE Extractor SHALL not modify any Supabase query logic, RLS policies, or data fetching patterns
5. THE Extractor SHALL not modify any CSS classes, Tailwind utilities, or inline styles
6. THE Extractor SHALL not introduce React Router or any state management library
7. THE Build SHALL produce a working production bundle (`npm run build` exits with code 0)

### Requirement 15: Incremental Extraction Process

**User Story:** As a developer, I want each extraction to be a self-contained step that can be verified independently, so that regressions are caught early.

#### Acceptance Criteria

1. THE Extractor SHALL perform extractions in dependency order: types first, then utilities (which depend on types), then constants, then components (which depend on types and utilities)
2. AFTER each extraction step, THE Build SHALL complete without TypeScript errors
3. THE Extractor SHALL not remove any code from `App.tsx` until the corresponding import from the new module is in place
4. IF an extraction step causes a build failure, THEN THE Extractor SHALL revert that step and diagnose the root cause before retrying
