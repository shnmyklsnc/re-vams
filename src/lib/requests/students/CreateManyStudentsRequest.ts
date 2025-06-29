import { z, ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { FormRequest } from '../BaseRequest';

// -----------------------------
// Schema Definitions
// -----------------------------

const studentSchema = z.object({
  id: z.string().min(1, 'Student ID is required and must be a string'),
  program: z.string().min(1, 'Program is required and must be a string'),
  year: z.number().int('Year must be an integer').min(1).max(6),
  degree: z.string().min(1, 'Degree is required and must be a string'),
  email_address: z.string().email('Invalid email address format'),
  first_name: z.string(),
  last_name: z.string(),
  middle_name: z.string().nullable().optional(),
  major: z.string().nullable().optional(),
}).passthrough();

const createManyStudentsSchema = z.object({
  students: z.array(studentSchema)
    .min(1, 'Students array cannot be empty')
    .max(100, 'Cannot create more than 100 students at once')
    .refine(
      students => new Set(students.map(s => s.id)).size === students.length,
      { message: 'Duplicate student IDs found in request', path: ['students'] }
    )
});

export type CreateManyStudentsData = z.infer<typeof createManyStudentsSchema>;

// -----------------------------
// CreateManyStudentsRequest Class
// -----------------------------

export class CreateManyStudentsRequest extends FormRequest<CreateManyStudentsData> {
  rules() {
    return createManyStudentsSchema;
  }

  async authorize(): Promise<boolean> {
    return true;
  }

  async validate(): Promise<NextResponse | null> {
    try {
      const body = await this.request.json();

      if (!body || !Array.isArray(body.students)) {
        return this.errorResponse('Payload must contain a valid "students" array.', 400);
      }

      if (!(await this.authorize())) {
        return this.errorResponse('This action is unauthorized.', 403);
      }

      this.validatedData = this.rules().parse(body);
      return null;

    } catch (error) {
      if (error instanceof ZodError) {
        return this.handleZodValidationError(error);
      }
      return this.errorResponse('Invalid JSON in request body.', 400);
    }
  }

  // -----------------------------
  // Zod Error Handler
  // -----------------------------

  private handleZodValidationError(error: ZodError): NextResponse {
    const firstError = error.errors[0];
    const [, index, field] = firstError.path;

    console.log('Zod Error Details:', {
      message: firstError.message,
      path: firstError.path,
      field,
      code: firstError.code,
    });

    const studentPrefix = typeof index === 'number' ? `Student at index ${index}` : 'Student';

    // Handle top-level array errors
    const topLevelMessage = this.getTopLevelErrorMessage(firstError.message);
    if (topLevelMessage) {
      return this.errorResponse(topLevelMessage, 400);
    }

    // Handle specific field errors
    if (typeof index === 'number' && field) {
      return this.getFieldErrorResponse(firstError, studentPrefix, field);
    }

    // Generic fallback
    return this.errorResponse(`Validation error: ${firstError.message}`, 400);
  }

  private getTopLevelErrorMessage(message: string): string | null {
    const map: Record<string, string> = {
      'Students array cannot be empty': 'No students provided.',
      'Cannot create more than 100 students at once': 'Maximum of 100 students allowed per request.',
      'Duplicate student IDs found in request': 'Duplicate student IDs found in request.',
    };
    return map[message] || null;
  }

  private getFieldErrorResponse(
    firstError: z.ZodIssue,
    studentPrefix: string,
    field: string | number
  ): NextResponse {
    if (field === 'email_address' && this.isEmailError(firstError)) {
      return this.errorResponse(`${studentPrefix} has an invalid email address format.`, 400);
    }

    if (field === 'year') {
      return this.getYearErrorResponse(firstError, studentPrefix);
    }

    if (['id', 'program'].includes(field as string) && this.isMissingFieldError(firstError)) {
      return this.errorResponse(`${studentPrefix} is missing required fields (id, program, year).`, 400);
    }

    if (['first_name', 'last_name'].includes(field as string) && firstError.code === 'invalid_type') {
      return this.errorResponse(`${studentPrefix} is missing required field: ${field}.`, 400);
    }

    return this.errorResponse(`${studentPrefix} has an invalid ${field}: ${firstError.message}`, 400);
  }

  private isEmailError(error: z.ZodIssue) {
    return error.code === 'invalid_string' && error.message.includes('email');
  }

  private isMissingFieldError(error: z.ZodIssue) {
    return error.code === 'too_small' || error.code === 'invalid_type';
  }

  private getYearErrorResponse(error: z.ZodIssue, studentPrefix: string): NextResponse {
    switch (error.code) {
      case 'too_big':
      case 'too_small':
        return this.errorResponse(`${studentPrefix} has an invalid year (must be 1-6).`, 400);
      case 'invalid_type':
        if (error.message.includes('integer')) {
          return this.errorResponse(`${studentPrefix} year must be a valid integer.`, 400);
        }
        return this.errorResponse(`${studentPrefix} year must be a number.`, 400);
      default:
        return this.errorResponse(`${studentPrefix} has an invalid year (must be 1-6).`, 400);
    }
  }

  private errorResponse(message: string, status: number): NextResponse {
    return NextResponse.json({ error: { code: status, message } }, { status });
  }



  //utilities
  getStudents() {
    return this.validated().students;
  }

  getStudentCount() {
    return this.getStudents().length;
  }

  hasStudentWithId(id: string) {
    return this.getStudents().some(s => s.id === id);
  }

  getStudent(index: number) {
    return this.getStudents()[index] ?? null;
  }

  getStudentsByYear(year: number) {
    return this.getStudents().filter(s => s.year === year);
  }

  getStudentsByProgram(program: string) {
    return this.getStudents().filter(s => s.program === program);
  }

  getUniquePrograms() {
    return [...new Set(this.getStudents().map(s => s.program))];
  }

  getUniqueYears() {
    return [...new Set(this.getStudents().map(s => s.year))].sort();
  }

  getStudentsWithEmails() {
    return this.getStudents().filter(s => s.email_address);
  }

  getValidationSummary() {
    const students = this.getStudents();
    return {
      totalStudents: students.length,
      programs: this.getUniquePrograms(),
      years: this.getUniqueYears(),
      studentsWithEmails: this.getStudentsWithEmails().length,
      studentsWithMiddleNames: students.filter(s => s.middle_name).length,
    };
  }
}
