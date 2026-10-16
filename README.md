# Transaction Processing Service

## About the Project

This project is a transaction processing service built using Python, FastAPI, and SQLite.

The API accepts transaction requests and stores them in the database. A separate background worker processes pending transactions and sends them to a mock posting service.

The main goal of this project is to handle transactions reliably, including duplicate requests, temporary errors, and worker recovery.

## Technologies Used

- Python
- FastAPI
- SQLite
- Uvicorn
- HTTP requests
- ThreadPoolExecutor for concurrent processing

## Main Features

- API for submitting and checking transactions
- Input validation
- SQLite database for storing transactions
- Background worker for processing pending transactions
- Retry handling for temporary errors
- Duplicate transaction handling
- Recovery of stale processing claims
- Logging of processing attempts and errors

## Project Structure

```text
openfabric_updated/
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/
│   ├── main.py
│   ├── transaction_worker.py
│   ├── db.py
│   └── README.md
├── tests/
│   ├── test_api.py
│   └── test_worker_recovery.py
├── requirements.txt
├── .gitignore
└── README.md
```

The `frontend` folder contains the user interface. The `backend` folder contains the API, transaction worker, and database logic. The `tests` folder contains automated tests for the API and worker recovery.

The SQLite database is created and managed by the backend during execution.

## Frontend

The frontend provides the user interface for interacting with the transaction processing service.

To run the frontend, navigate to the `frontend` directory and follow the available setup instructions in its `package.json`.

## Running the Project

The API and background worker run separately.

1. Install the required Python packages using the root `requirements.txt` file or the dependency instructions in the backend README.
2. Start the FastAPI application.
3. Start the background worker in a separate terminal.
4. Use the API documentation to submit and test transactions.

For detailed setup commands and testing instructions, see [Backend Setup and Testing](backend/README.md).

## Testing

During development, I tested transaction submission, input validation, transaction processing, duplicate handling, and recovery of stale worker claims.

The automated test suite completed with the following results:

- Total tests: 8
- Passed: 8
- Failed: 0
- Execution time: 1.64 seconds

The detailed test cases and observations are documented in the backend README.

## Note

This project was developed as a transaction-processing assignment. Actual processing performance depends on database operations, worker concurrency, and the response time of the mock posting service.