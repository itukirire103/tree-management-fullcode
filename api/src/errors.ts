export class NotFoundError extends Error {
  constructor(message = "指定されたレコードが見つかりません。") {
    super(message);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
