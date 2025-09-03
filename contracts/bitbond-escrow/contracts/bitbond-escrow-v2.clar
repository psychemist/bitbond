;; title: bitbond-escrow-v2
;; version: 2.0
;; summary: BitBond Escrow Contract with Two-Phase Verification
;; description: Enhanced accountability buddy system with foolproof verification

;; BitBond Escrow Contract V2
;; Accountability buddy system where users stake STX on task completion
;; verified by assigned buddies with two-phase verification system

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))
(define-constant err-invalid-amount (err u103))
(define-constant err-task-expired (err u104))
(define-constant err-task-already-verified (err u105))
(define-constant err-insufficient-balance (err u106))
(define-constant err-same-user (err u107))
(define-constant err-invalid-deadline (err u108))
(define-constant err-not-marked-complete (err u109))
(define-constant err-verification-expired (err u110))
(define-constant err-already-marked-complete (err u111))

;; Data structures
(define-map tasks
  { task-id: uint }
  {
    creator: principal,
    buddy: principal,
    title: (string-ascii 100),
    description: (string-ascii 500),
    stake-amount: uint,
    deadline: uint,
    status: (string-ascii 20), ;; "active", "completed", "pending-verification", "verified", "failed", "expired"
    created-at: uint,
    marked-completed-at: (optional uint), ;; When creator marked as done
    verified: bool,
    verification-time: (optional uint)
  }
)

(define-map user-stats
  { user: principal }
  {
    tasks-created: uint,
    tasks-completed: uint,
    tasks-failed: uint,
    total-staked: uint
  }
)

;; Data variables
(define-data-var next-task-id uint u1)
(define-data-var contract-balance uint u0)

;; Private functions
(define-private (is-task-expired (deadline uint))
  (> stacks-block-height deadline)
)

(define-private (update-user-stats (user principal) (tasks-created uint) (tasks-completed uint) (tasks-failed uint) (staked uint))
  (let ((current-stats (default-to 
                         { tasks-created: u0, tasks-completed: u0, tasks-failed: u0, total-staked: u0 }
                         (map-get? user-stats { user: user }))))
    (map-set user-stats { user: user }
      {
        tasks-created: (+ (get tasks-created current-stats) tasks-created),
        tasks-completed: (+ (get tasks-completed current-stats) tasks-completed),
        tasks-failed: (+ (get tasks-failed current-stats) tasks-failed),
        total-staked: (+ (get total-staked current-stats) staked)
      }
    )
  )
)

;; Public functions

;; Create a new accountability task
(define-public (create-task (buddy principal) (title (string-ascii 100)) (description (string-ascii 500)) (stake-amount uint) (deadline uint))
  (let ((task-id (var-get next-task-id))
        (creator tx-sender)
        (current-height stacks-block-height))
    (asserts! (> stake-amount u0) err-invalid-amount)
    (asserts! (> deadline current-height) err-invalid-deadline)
    (asserts! (not (is-eq creator buddy)) err-same-user)
    (asserts! (>= (stx-get-balance creator) stake-amount) err-insufficient-balance)
    
    ;; Transfer stake to contract
    (try! (stx-transfer? stake-amount creator (as-contract tx-sender)))
    
    ;; Create task with enhanced data structure
    (map-set tasks { task-id: task-id }
      {
        creator: creator,
        buddy: buddy,
        title: title,
        description: description,
        stake-amount: stake-amount,
        deadline: deadline,
        status: "active",
        created-at: current-height,
        marked-completed-at: none,
        verified: false,
        verification-time: none
      }
    )
    
    ;; Update stats and contract balance
    (update-user-stats creator u1 u0 u0 stake-amount)
    (var-set contract-balance (+ (var-get contract-balance) stake-amount))
    (var-set next-task-id (+ task-id u1))
    
    (ok task-id)
  )
)

;; Creator marks task as completed (Phase 1)
(define-public (mark-task-completed (task-id uint))
  (let ((task-data (unwrap! (map-get? tasks { task-id: task-id }) err-not-found))
        (creator tx-sender)
        (current-height stacks-block-height))
    
    ;; Validate caller is the task creator
    (asserts! (is-eq creator (get creator task-data)) err-unauthorized)
    
    ;; Check task is still active
    (asserts! (is-eq (get status task-data) "active") err-task-already-verified)
    
    ;; Check task hasn't expired yet (creator can't mark expired tasks)
    (asserts! (<= current-height (get deadline task-data)) err-task-expired)
    
    ;; Check not already marked as completed
    (asserts! (is-none (get marked-completed-at task-data)) err-already-marked-complete)
    
    ;; Mark as completed and pending verification
    (map-set tasks { task-id: task-id }
      (merge task-data {
        status: "pending-verification",
        marked-completed-at: (some current-height)
      })
    )
    
    (ok true)
  )
)

;; Buddy verifies task completion (Phase 2) - UPDATED with new logic
(define-public (verify-task (task-id uint) (success bool))
  (let ((task-data (unwrap! (map-get? tasks { task-id: task-id }) err-not-found))
        (verifier tx-sender)
        (current-height stacks-block-height)
        (marked-at (unwrap! (get marked-completed-at task-data) err-not-marked-complete)))
    
    ;; Validate verifier is the assigned buddy
    (asserts! (is-eq verifier (get buddy task-data)) err-unauthorized)
    
    ;; Check task is pending verification (creator marked it complete)
    (asserts! (is-eq (get status task-data) "pending-verification") err-not-marked-complete)
    
    ;; Check task hasn't been verified yet
    (asserts! (not (get verified task-data)) err-task-already-verified)
    
    ;; Buddy has 48 hours (288 blocks) to verify after creator marks complete
    (asserts! (<= current-height (+ marked-at u288)) err-verification-expired)
    
    (if success
      ;; Task successful - return stake to creator
      (begin
        (try! (as-contract (stx-transfer? (get stake-amount task-data) tx-sender (get creator task-data))))
        (map-set tasks { task-id: task-id }
          (merge task-data {
            status: "verified",
            verified: true,
            verification-time: (some current-height)
          })
        )
        (update-user-stats (get creator task-data) u0 u1 u0 u0)
        (var-set contract-balance (- (var-get contract-balance) (get stake-amount task-data)))
      )
      ;; Task failed - transfer stake to buddy as reward
      (begin
        (try! (as-contract (stx-transfer? (get stake-amount task-data) tx-sender (get buddy task-data))))
        (map-set tasks { task-id: task-id }
          (merge task-data {
            status: "failed",
            verified: true,
            verification-time: (some current-height)
          })
        )
        (update-user-stats (get creator task-data) u0 u0 u1 u0)
        (var-set contract-balance (- (var-get contract-balance) (get stake-amount task-data)))
      )
    )
    
    (ok success)
  )
)

;; UPDATED: Handle expired scenarios
(define-public (handle-expired-task (task-id uint))
  (let ((task-data (unwrap! (map-get? tasks { task-id: task-id }) err-not-found))
        (caller tx-sender)
        (current-height stacks-block-height))
    
    ;; Check task is actually expired
    (asserts! (> current-height (get deadline task-data)) err-task-expired)
    
    ;; Check task hasn't been verified yet
    (asserts! (not (get verified task-data)) err-task-already-verified)
    
    (match (get marked-completed-at task-data)
      ;; Case 1: Creator marked complete but buddy didn't verify in time
      marked-time
        (begin
          ;; Check if 48hrs passed since marked complete
          (asserts! (> current-height (+ marked-time u288)) err-verification-expired)
          ;; Buddy failed to verify - creator gets stake back (buddy loses reward opportunity)
          (asserts! (is-eq caller (get creator task-data)) err-unauthorized)
          (try! (as-contract (stx-transfer? (get stake-amount task-data) tx-sender (get creator task-data))))
          (map-set tasks { task-id: task-id }
            (merge task-data {
              status: "expired",
              verified: true,
              verification-time: (some current-height)
            })
          )
          (var-set contract-balance (- (var-get contract-balance) (get stake-amount task-data)))
          (ok true)
        )
      ;; Case 2: Creator never marked complete and deadline passed
      ;; This means creator failed to complete task - buddy gets the stake!
      (begin
        (asserts! (is-eq caller (get buddy task-data)) err-unauthorized)
        (try! (as-contract (stx-transfer? (get stake-amount task-data) tx-sender (get buddy task-data))))
        (map-set tasks { task-id: task-id }
          (merge task-data {
            status: "expired",
            verified: true,
            verification-time: (some current-height)
          })
        )
        (update-user-stats (get creator task-data) u0 u0 u1 u0)
        (var-set contract-balance (- (var-get contract-balance) (get stake-amount task-data)))
        (ok true)
      )
    )
  )
)

;; Read-only functions

;; Get task details
(define-read-only (get-task (task-id uint))
  (map-get? tasks { task-id: task-id })
)

;; Simple function to check if a task belongs to a creator
(define-read-only (is-task-by-creator (task-id uint) (creator principal))
  (match (map-get? tasks { task-id: task-id })
    task-data (is-eq creator (get creator task-data))
    false
  )
)

;; Simple function to check if a task has a specific buddy
(define-read-only (is-task-by-buddy (task-id uint) (buddy principal))
  (match (map-get? tasks { task-id: task-id })
    task-data (is-eq buddy (get buddy task-data))
    false
  )
)

;; Get user statistics
(define-read-only (get-user-stats (user principal))
  (default-to 
    { tasks-created: u0, tasks-completed: u0, tasks-failed: u0, total-staked: u0 }
    (map-get? user-stats { user: user })
  )
)

;; Get next task ID
(define-read-only (get-next-task-id)
  (var-get next-task-id)
)

;; Get contract balance
(define-read-only (get-contract-balance)
  (var-get contract-balance)
)

;; Check if task is expired
(define-read-only (is-task-expired-check (task-id uint))
  (match (map-get? tasks { task-id: task-id })
    task-data (is-task-expired (get deadline task-data))
    false
  )
)

