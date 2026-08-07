from pydantic import BaseModel, ConfigDict

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  #SQLAlchemyモデルからPydanticモデルの変換許可
    id: int
    username: str
