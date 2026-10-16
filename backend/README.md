# Backend Setup and Testing

## 1. Requirements

Install the following before running the project:

- Python 3.10 or a compatible Python version
- pip
- Windows Command Prompt or PowerShell
- Internet connection to access the mock posting service

SQLite is used through Python's built-in `sqlite3` module, so a separate SQLite server is not required.

Redis and Docker are not required for the current implementation.

## 2. Install Dependencies

Open Command Prompt and navigate to the backend folder:

```cmd
cd /d C:\openfabric_updated\backend
```

Create a virtual environment if one does not already exist:

```cmd
python -m venv env
```

Activate it:

```cmd
env\Scripts\activate
```

Install the packages listed in the project's requirements file:

```cmd
pip install -r requirements.txt
```

If the virtual environment already exists, activate it instead of creating another one.

## 3. Start the API

Open a terminal in the backend folder and run:

```cmd
python -m uvicorn main:app --reload
```

The API will normally be available at:

```text
http://127.0.0.1:8000
```

Open the API documentation in a browser:

```text
http://127.0.0.1:8000/docs
```

The documentation page can be used to view available endpoints and submit test requests.

## 4. Start the Background Worker

Open a second terminal. Activate the same virtual environment and navigate to the backend folder.

Run:

```cmd
python transaction_worker.py
```

Keep both the API and worker running. The API accepts transactions, while the worker processes pending transactions in the background.

## 5. How Transaction Processing Works

1. A client submits a transaction to the API.
2. The API validates the request and stores the transaction in SQLite.
3. The API returns an acceptance response.
4. The background worker claims a pending transaction.
5. The worker checks whether the transaction already exists in the mock posting service.
6. If it does not exist, the worker attempts to post it.
7. The worker updates the transaction status and records the processing attempt.
8. If a temporary error occurs, the worker retries or schedules another attempt, depending on the error.
9. Stale processing claims are recovered so that abandoned transactions can be processed again.

## 6. Worker Configuration

The following settings are defined in `transaction_worker.py`:

| Setting | Value |
|---|---:|
| Maximum worker tasks | 8 |
| Attempts per processing loop | 3 |
| HTTP request timeout | 12 seconds |
| Base retry delay | 2 seconds |
| Maximum scheduled retry delay | 60 seconds |
| Claim timeout | 20 seconds |

The worker uses a bounded thread pool to process transactions concurrently.

## 7. Tests Performed

The following checks were performed during development.

| Test | Result |
|---|---|
| Submit a valid transaction | Passed |
| Check transaction completion | Passed |
| Submit a negative amount | Rejected with HTTP 422 |
| Submit a timestamp without timezone | Rejected with HTTP 422 |
| Submit an existing transaction again | Existing transaction handled without unnecessary reprocessing |
| Recover a stale processing claim | Passed |
| Check final transaction status and cleared claim fields | Passed |
| Check database for invalid claim-token states | No invalid records found in the check |
| Observe retry handling in worker logs | Retry attempts observed |

A database consistency check showed 202 completed transactions and 1 pending transaction at that point in development. The check found zero invalid claim records. These figures describe the database state during testing, not a throughput benchmark.

## 8. Retry Handling

The worker distinguishes between retryable errors and permanent errors.

- HTTP 408, HTTP 429, and HTTP 5xx responses are considered retryable by the retry helper.
- Other HTTP error responses, such as HTTP 400, are treated as permanent failures by that helper.
- Network errors and uncertain remote transaction states are deferred for later checking.
- After a POST error, the worker checks the remote service before deciding whether the transaction needs to be posted again.

The actual behavior also depends on where the error occurs in the processing flow.

## 9. Current Limitations

The project uses SQLite and a mock posting service. Actual processing throughput depends on database contention, worker concurrency, and remote request latency.

The development tests verified the main processing and recovery flows. A sustained TPS benchmark should be reported separately only after measuring it under a defined load.
## 10. Automated Test Results

I ran the automated tests using pytest.

- Total tests: 8
- Passed: 8
- Failed: 0
- Execution time: 1.64 seconds

The tests cover API health, CORS, idempotency, input validation, the metrics endpoint, and stale worker claim recovery.
## 11. Conclusion

This project helped me understand API development, database operations, background processing, retry handling, and recovery of interrupted work using Python.
