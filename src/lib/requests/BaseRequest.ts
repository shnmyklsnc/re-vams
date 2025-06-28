import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodType, ZodTypeDef } from 'zod';

export abstract class BaseRequest<T = any> {
  protected request: NextRequest;
  protected validatedData?: T;

  constructor(request: NextRequest) {
    this.request = request;
  }

  abstract rules(): ZodType<T, ZodTypeDef, any>;
  abstract authorize(): Promise<boolean> | boolean;

  //Custom error messages
  messages(): Record<string, string> {
    return {};
  }

  // Main validation method
  async validate(): Promise<NextResponse | null> {
    // Check authorization first
    const authorized = await this.authorize();
    if (!authorized) {
      return this.unauthorizedResponse();
    }

    try {
      // Parse request body
      const body = await this.request.json();
      
      // Validate against schema
      const schema = this.rules();
      this.validatedData = schema.parse(body);
      
      return null; // No errors
    } catch (error) {
      if (error instanceof ZodError) {
        return this.validationErrorResponse(error);
      }
      return this.invalidJsonResponse();
    }
  }

  // Get validated data
  validated(): T {
    if (!this.validatedData) {
      throw new Error('Request must be validated first');
    }
    return this.validatedData;
  }

  // Get specific field from validated data
  input<K extends keyof T>(key: K): T[K] {
    return this.validated()[key];
  }

  // Get all input data
  all(): T {
    return this.validated();
  }

  // Response helpers
  protected unauthorizedResponse(): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: 403,
          message: 'This action is unauthorized.',
        },
      },
      { status: 403 }
    );
  }

  protected validationErrorResponse(error: ZodError): NextResponse {
    // Get the first error for simplicity (matching your current style)
    const firstError = error.errors[0];
    
    return NextResponse.json(
      {
        error: {
          code: 400,
          message: firstError.message,
        },
      },
      { status: 400 }
    );
  }

  protected invalidJsonResponse(): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: 400,
          message: 'Invalid JSON in request body.',
        },
      },
      { status: 400 }
    );
  }
}

// FormRequest class for body-based requests
export abstract class FormRequest<T = any> extends BaseRequest<T> {
  // FormRequest is specifically for POST/PUT/PATCH requests with JSON body
}