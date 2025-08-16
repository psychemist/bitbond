;; title: bitbond-escrow
;; version:
;; summary:
;; description:

;; BitBond Escrow Contract
;; Accountability buddy system where users stake STX on task completion
;; verified by assigned buddies

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
    status: (string-ascii 20),
    created-at: uint,
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
    
    ;; Create task
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

;; Buddy verifies task completion (successful)
(define-public (verify-task (task-id uint) (success bool))
  (let ((task-data (unwrap! (map-get? tasks { task-id: task-id }) err-not-found))
        (verifier tx-sender)
        (current-height stacks-block-height))
    
    ;; Validate verifier is the assigned buddy
    (asserts! (is-eq verifier (get buddy task-data)) err-unauthorized)
    
    ;; Check task hasn't been verified yet
    (asserts! (not (get verified task-data)) err-task-already-verified)
    
    ;; Check task hasn't expired (allow some grace period for verification)
    (asserts! (<= current-height (+ (get deadline task-data) u144)) err-task-expired) ;; 24 hour grace period
    
    (if success
      ;; Task successful - return stake to creator
      (begin
        (try! (as-contract (stx-transfer? (get stake-amount task-data) tx-sender (get creator task-data))))
        (map-set tasks { task-id: task-id }
          (merge task-data {
            status: "completed",
            verified: true,
            verification-time: (some current-height)
          })
        )
        (update-user-stats (get creator task-data) u0 u1 u0 u0)
      )
      ;; Task failed - forfeit stake (keep in contract for now)
      (begin
        (map-set tasks { task-id: task-id }
          (merge task-data {
            status: "failed",
            verified: true,
            verification-time: (some current-height)
          })
        )
        (update-user-stats (get creator task-data) u0 u0 u1 u0)
      )
    )
    
    (ok success)
  )
)

;; Emergency function: Creator can reclaim stake if task expired and buddy hasn't verified
(define-public (reclaim-expired-stake (task-id uint))
  (let ((task-data (unwrap! (map-get? tasks { task-id: task-id }) err-not-found))
        (claimer tx-sender)
        (current-height stacks-block-height))
    
    ;; Validate claimer is the task creator
    (asserts! (is-eq claimer (get creator task-data)) err-unauthorized)
    
    ;; Check task hasn't been verified yet
    (asserts! (not (get verified task-data)) err-task-already-verified)
    
    ;; Check task is well past deadline (48 hour grace period)
    (asserts! (> current-height (+ (get deadline task-data) u288)) err-task-expired)
    
    ;; Return stake to creator
    (try! (as-contract (stx-transfer? (get stake-amount task-data) tx-sender (get creator task-data))))
    
    ;; Update task status
    (map-set tasks { task-id: task-id }
      (merge task-data {
        status: "expired",
        verified: true,
        verification-time: (some current-height)
      })
    )
    
    (ok true)
  )
)

;; Read-only functions

;; Get task details
(define-read-only (get-task (task-id uint))
  (map-get? tasks { task-id: task-id })
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

