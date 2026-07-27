---- MODULE DetailsPanelPersistence ----
EXTENDS Naturals

(***************************************************************************
The drawer width is derived from the tree and main-column widths. This model
holds the viewport and tree width fixed and explores every ordering of drag,
release, debounce flush, close, and reopen actions while the main column stays
above its minimum.

The finite MainWidths set is a data-independent abstraction: transitions only
copy and compare widths; they never branch on a width's magnitude. TLC can
therefore exhaustively check the persistence protocol with representative
distinct widths without tracking an independent outer-edge preference.
***************************************************************************)

CONSTANTS MainWidths,
          InitialMainWidth,
          TreeWidth,
          SeparatorWidth,
          NoWidth,
          CloseCommitsRenderedWidth

ASSUME /\ MainWidths \subseteq (Nat \ {0})
       /\ InitialMainWidth \in MainWidths
       /\ TreeWidth \in Nat
       /\ SeparatorWidth \in Nat
       /\ NoWidth = 0
       /\ CloseCommitsRenderedWidth \in BOOLEAN

VARIABLES phase,
          dragging,
          renderedMainWidth,
          storedMainWidth,
          pendingMainWidth,
          releasedMainWidth,
          resizedSinceOpen,
          justReopened

vars == <<phase,
          dragging,
          renderedMainWidth,
          storedMainWidth,
          pendingMainWidth,
          releasedMainWidth,
          resizedSinceOpen,
          justReopened>>

DrawerWidth(mainWidth) == TreeWidth + SeparatorWidth + mainWidth

Init ==
    /\ phase = "open"
    /\ dragging = FALSE
    /\ renderedMainWidth = InitialMainWidth
    /\ storedMainWidth = InitialMainWidth
    /\ pendingMainWidth = NoWidth
    /\ releasedMainWidth = NoWidth
    /\ resizedSinceOpen = FALSE
    /\ justReopened = FALSE

StartDrag ==
    /\ phase = "open"
    /\ ~dragging
    /\ dragging' = TRUE
    /\ justReopened' = FALSE
    /\ UNCHANGED <<phase,
                    renderedMainWidth,
                    storedMainWidth,
                    pendingMainWidth,
                    releasedMainWidth,
                    resizedSinceOpen>>

Move ==
    /\ phase = "open"
    /\ dragging
    /\ \E width \in MainWidths:
        /\ renderedMainWidth' = width
        /\ pendingMainWidth' = width
    /\ resizedSinceOpen' = TRUE
    /\ justReopened' = FALSE
    /\ UNCHANGED <<phase,
                    dragging,
                    storedMainWidth,
                    releasedMainWidth>>

ReleaseSynchronously ==
    /\ phase = "open"
    /\ dragging
    /\ dragging' = FALSE
    /\ releasedMainWidth' = renderedMainWidth
    /\ storedMainWidth' = renderedMainWidth
    /\ pendingMainWidth' = NoWidth
    /\ justReopened' = FALSE
    /\ UNCHANGED <<phase, renderedMainWidth, resizedSinceOpen>>

ReleaseDelayed ==
    /\ phase = "open"
    /\ dragging
    /\ dragging' = FALSE
    /\ releasedMainWidth' = renderedMainWidth
    /\ pendingMainWidth' = renderedMainWidth
    /\ justReopened' = FALSE
    /\ UNCHANGED <<phase,
                    renderedMainWidth,
                    storedMainWidth,
                    resizedSinceOpen>>

FlushDebouncedWrite ==
    /\ pendingMainWidth # NoWidth
    /\ storedMainWidth' = pendingMainWidth
    /\ pendingMainWidth' = NoWidth
    /\ justReopened' = FALSE
    /\ UNCHANGED <<phase,
                    dragging,
                    renderedMainWidth,
                    releasedMainWidth,
                    resizedSinceOpen>>

Close ==
    /\ phase = "open"
    /\ phase' = "closed"
    /\ dragging' = FALSE
    /\ storedMainWidth' =
        IF CloseCommitsRenderedWidth /\ resizedSinceOpen
        THEN renderedMainWidth
        ELSE storedMainWidth
    /\ pendingMainWidth' =
        IF CloseCommitsRenderedWidth /\ resizedSinceOpen
        THEN NoWidth
        ELSE pendingMainWidth
    /\ releasedMainWidth' =
        IF resizedSinceOpen
        THEN renderedMainWidth
        ELSE releasedMainWidth
    /\ justReopened' = FALSE
    /\ UNCHANGED <<renderedMainWidth, resizedSinceOpen>>

Open ==
    /\ phase = "closed"
    /\ phase' = "open"
    /\ renderedMainWidth' = storedMainWidth
    /\ resizedSinceOpen' = FALSE
    /\ justReopened' = TRUE
    /\ UNCHANGED <<dragging,
                    storedMainWidth,
                    pendingMainWidth,
                    releasedMainWidth>>

Next == StartDrag
     \/ Move
     \/ ReleaseSynchronously
     \/ ReleaseDelayed
     \/ FlushDebouncedWrite
     \/ Close
     \/ Open

Spec == Init /\ [][Next]_vars

TypeOK ==
    /\ phase \in {"open", "closed"}
    /\ dragging \in BOOLEAN
    /\ renderedMainWidth \in MainWidths
    /\ storedMainWidth \in MainWidths
    /\ pendingMainWidth \in MainWidths \cup {NoWidth}
    /\ releasedMainWidth \in MainWidths \cup {NoWidth}
    /\ resizedSinceOpen \in BOOLEAN
    /\ justReopened \in BOOLEAN

ReopenRestoresReleasedWidth ==
    (justReopened /\ releasedMainWidth # NoWidth)
    => DrawerWidth(renderedMainWidth) = DrawerWidth(releasedMainWidth)

Safety == TypeOK /\ ReopenRestoresReleasedWidth

THEOREM SafetyTheorem == Spec => []Safety

====
