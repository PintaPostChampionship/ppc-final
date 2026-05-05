# Tasks: App.tsx Decomposition

## Phase 1: Extract Types

- [x] 1.1 Create `src/types/index.ts` with all shared interfaces: `Profile`, `PlayerCard`, `HistoricPlayer`, `Location`, `AvailabilitySlot`, `Tournament`, `Division`, `Registration`, `Match`, `MatchSet`, `Standings`
- [x] 1.2 Add type aliases to `src/types/index.ts`: `BookingAdmin`, `BookingAccount`, `CourtBookingRequest`, `SocialEvent`, `PendingOnboarding`, `PPCNotif`, `BookingVenueKey`
- [x] 1.3 Replace inline type definitions in `App.tsx` with imports from `src/types/index.ts`
- [x] 1.4 Add type imports from `src/types/index.ts` to any existing modules that need them (e.g., `usePaymentStatus.ts`, `LiveScoreboard/` files)
- [x] 1.5 Verify `src/types/payment.ts` is unchanged
- [x] 1.6 Run `npm run build` — must pass with zero errors

## Phase 2: Extract Utility Functions

### 2A: Tournament Utils (extracted first — depended on by playerUtils)

- [x] 2.1 Create `src/lib/tournamentUtils.ts` with `isCalibrationTournamentByName` and `isOfficialMatchByTournamentId`
- [x] 2.2 Add type imports from `src/types/index.ts` to `tournamentUtils.ts`
- [x] 2.3 Replace inline definitions in `App.tsx` with imports from `src/lib/tournamentUtils.ts`
- [x] 2.4 Run `npm run build` — must pass with zero errors

### 2B: Date Utils

- [x] 2.5 Create `src/lib/dateUtils.ts` with `formatISOToDDMMYYYY`, `parseDDMMYYYYToISO`, `tituloFechaEs`, `isTodayOrFuture`, `parseYMDLocal`, `formatDateLocal`, `dateKey`
- [x] 2.6 Move the date functions that are currently defined inside the App component body (`tituloFechaEs`, `isTodayOrFuture`, `parseYMDLocal`, `formatDateLocal`, `dateKey`) to module scope in `dateUtils.ts`
- [x] 2.7 Replace inline definitions in `App.tsx` with imports from `src/lib/dateUtils.ts`
- [x] 2.8 Run `npm run build` — must pass with zero errors

### 2C: Player Utils

- [x] 2.9 Create `src/lib/playerUtils.ts` with `getPlayerStatsSummaryAll`, `getLeagueRegistrationsForPlayer`, `getLastLeagueEntryForPlayer`, `getFirstLeagueEntryForPlayer`, `getPrettyLeagueResultForPlayer`, `getDivisionNameByIdLocal`, `getAgeFromBirthDate`
- [x] 2.10 Add type imports from `src/types/index.ts` and function imports from `src/lib/tournamentUtils.ts` to `playerUtils.ts`
- [x] 2.11 Replace inline definitions in `App.tsx` with imports from `src/lib/playerUtils.ts`
- [x] 2.12 Run `npm run build` — must pass with zero errors

### 2D: Display Utils

- [x] 2.13 Create `src/lib/displayUtils.ts` with `toTitleCase`, `uiName`, `capitaliseFirst`, `divisionLogoSrc`, `divisionColors`, `divisionIcon`, `tournamentLogoSrc`
- [x] 2.14 Note: `divisionIcon` and `tournamentLogoSrc` are currently defined inside the App component body — move them to module scope in `displayUtils.ts` (they are pure functions with no state dependency)
- [x] 2.15 Replace inline definitions in `App.tsx` with imports from `src/lib/displayUtils.ts`
- [x] 2.16 Run `npm run build` — must pass with zero errors

### 2E: Image Utils

- [x] 2.17 Create `src/lib/imageUtils.ts` with `dataURItoBlob`, `dataURLtoFile`, `resizeImage`, `avatarSrc`, `hasExplicitAvatar`
- [x] 2.18 Import `supabase` from `src/lib/supabaseClient.ts` in `imageUtils.ts` for the `avatarSrc` function
- [x] 2.19 Add type imports from `src/types/index.ts` to `imageUtils.ts`
- [x] 2.20 Replace inline definitions in `App.tsx` with imports from `src/lib/imageUtils.ts`
- [x] 2.21 Run `npm run build` — must pass with zero errors

### 2F: Onboarding Utils

- [x] 2.22 Create `src/lib/onboardingUtils.ts` with `compressAvailability`, `decompressAvailability`, `savePending`, `loadPending`, `clearPending`, `migrateLocalToSession`
- [x] 2.23 Move `PENDING_KEY` constant to `onboardingUtils.ts` as a module-scoped (non-exported) variable
- [x] 2.24 Import `PendingOnboarding` type from `src/types/index.ts` in `onboardingUtils.ts`
- [x] 2.25 Replace inline definitions in `App.tsx` with imports from `src/lib/onboardingUtils.ts`
- [x] 2.26 Run `npm run build` — must pass with zero errors

## Phase 3: Extract Constants

- [x] 3.1 Create `src/lib/constants.ts` with `BUSCAR_CLASES_ALLOWED_ID`, `PHOTOS_BASE_PATH`, `highlightPhotos`, `BOOKING_VENUES`
- [x] 3.2 Move `BookingVenueKey` type to `src/types/index.ts` (if not already done in Phase 1)
- [x] 3.3 Replace inline definitions in `App.tsx` with imports from `src/lib/constants.ts`
- [x] 3.4 Run `npm run build` — must pass with zero errors

## Phase 4: Extract Components

### 4A: PlayerShowcaseCard

- [x] 4.1 Create `src/components/PlayerShowcaseCard.tsx` with the `PlayerShowcaseCard` component and its props type
- [x] 4.2 Add imports from `src/types/index.ts`, `src/lib/displayUtils.ts`, `src/lib/playerUtils.ts`, and `src/lib/dateUtils.ts`
- [x] 4.3 Replace inline definition in `App.tsx` with import from `src/components/PlayerShowcaseCard.tsx`
- [x] 4.4 Run `npm run build` — must pass with zero errors

### 4B: BracketView

- [x] 4.5 Create `src/components/BracketView.tsx` with `BracketView`, `BracketPlayerSlot`, `BracketMatchCard` components and their props types (`BracketViewProps`, `BracketPlayerSlotProps`, `BracketMatchCardProps`, `BracketAnyPlayer`)
- [x] 4.6 Move `getNextMatchPosition` and `advanceWinner` helper functions to `BracketView.tsx` as module-scoped functions
- [x] 4.7 Add imports from `src/types/index.ts`, `src/lib/displayUtils.ts`, and `src/lib/supabaseClient.ts`
- [x] 4.8 Replace inline definition in `App.tsx` with import from `src/components/BracketView.tsx`
- [x] 4.9 Run `npm run build` — must pass with zero errors

### 4C: NavPlayerSearch

- [x] 4.10 Create `src/components/NavPlayerSearch.tsx` with the `NavPlayerSearch` component and its props type
- [x] 4.11 Add imports from `src/types/index.ts`
- [x] 4.12 Replace inline definition in `App.tsx` with import from `src/components/NavPlayerSearch.tsx`
- [x] 4.13 Run `npm run build` — must pass with zero errors

### 4D: NavTournamentsSection

- [x] 4.14 Create `src/components/NavTournamentsSection.tsx` with the `NavTournamentsSection` component and its props type
- [x] 4.15 Add imports from `src/types/index.ts`
- [x] 4.16 Replace inline definition in `App.tsx` with import from `src/components/NavTournamentsSection.tsx`
- [x] 4.17 Run `npm run build` — must pass with zero errors

## Phase 5: Write Property-Based Tests

- [x] 5.1 Create `src/__tests__/onboardingUtils.test.ts` with property test: availability compression round-trip (min 100 iterations with fast-check)
- [x] 5.2 Create `src/__tests__/dateUtils.test.ts` with property test: date parsing and formatting consistency (min 100 iterations with fast-check)
- [x] 5.3 Add example-based unit tests for edge cases: `formatISOToDDMMYYYY(null)`, `parseDDMMYYYYToISO('30/02/2024')`, `isCalibrationTournamentByName('Calibraciones PPC')`, `toTitleCase('josé maría')`, `compressAvailability(undefined)`
- [x] 5.4 Run `npx vitest --run` — all tests must pass

## Phase 6: Final Verification

- [x] 6.1 Run `npm run build` — final production build must succeed
- [x] 6.2 Verify no circular imports exist between new modules
- [x] 6.3 Verify `package.json` dependencies are unchanged (no new runtime deps)
- [x] 6.4 Verify `src/types/payment.ts` content is unchanged
- [x] 6.5 Verify `src/lib/supabaseClient.ts` remains the single source of the Supabase client instance
