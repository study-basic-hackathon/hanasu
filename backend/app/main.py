from fastapi import FastAPI

app = FastAPI(title="hanasu API")

@app.get("/")
def root():
    return {"message": "hello hanasu"}
