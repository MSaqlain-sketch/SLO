import sqlite3

# Database create/connect
conn = sqlite3.connect("slo_ai.db")

cursor = conn.cursor()

# SLO table
cursor.execute("""
INSERT INTO slos (
    board,
    grade,
    subject,
    chapter,
    topic,
    slo_code,
    slo_statement,
    learning_content
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", (
    "AKU-EB",
    "XII",
    "Computer Science",
    "9",
    "9.1",
    "9.1.1",
    "Describe the use of digital device in terms of ease of use and efficiency.",
    """
Ease of use means how simple a digital device is to understand and operate.

Efficiency means completing a task with less time and effort.

Example:
An ATM is easy to use because it provides clear instructions.
It is efficient because users can withdraw money quickly without waiting for bank staff.
"""
))

conn.commit()
conn.close()

print("Database created successfully!")