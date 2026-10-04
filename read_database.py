import sqlite3

# Database connect
conn = sqlite3.connect("slo_ai.db")

cursor = conn.cursor()

# SLO 9.1.1 database se nikalo
cursor.execute("""
SELECT slo_code, slo_statement, learning_content
FROM slos
WHERE slo_code = ?
""", ("9.1.1",))

slo = cursor.fetchone()

# Result print
print("SLO Code:")
print(slo[0])

print("\nSLO Statement:")
print(slo[1])

print("\nLearning Content:")
print(slo[2])

conn.close()