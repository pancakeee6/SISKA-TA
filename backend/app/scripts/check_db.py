from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:postgres@localhost:5432/postgres')
with engine.connect() as conn:
    result = conn.execute(text("SELECT datname FROM pg_database WHERE datistemplate = false;"))
    print("Databases:", [row[0] for row in result])

engine2 = create_engine('postgresql://postgres:postgres@localhost:5432/siska')
with engine2.connect() as conn:
    result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
    print("Tables in siska:", [row[0] for row in result])
