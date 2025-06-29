import { z, ZodError } from 'zod';
import { NextResponse } from 'next/server';
import { BaseRequest } from '../BaseRequest';

// -----------------------------
// Schema Definitions
// -----------------------------

const getStudentsSchema = z.object({
  page: z.coerce.number().int().min(1),
  limit: z.coerce.number().int().min(1).max(100),
  search: z.string().optional(),
  program_id: z.coerce.number().int().min(1).optional(),
  degree_id: z.coerce.number().int().min(1).optional(),
  year: z.coerce.number().int().min(1).max(6).optional(),
  sort_by: z.enum(['id', 'first_name', 'last_name', 'year', 'created_at']),
  sort_order: z.enum(['asc', 'desc']),
});

export type GetStudentsData = z.infer<typeof getStudentsSchema>;

// -----------------------------
// GetStudentsRequest Class
// -----------------------------

export class GetStudentsRequest extends BaseRequest<GetStudentsData> {
  rules() {
    return getStudentsSchema;
  }

  async authorize(): Promise<boolean> {
    return true;
  }

  async validate(): Promise<NextResponse | null> {
    try {
      if (!(await this.authorize())) {
        return this.unauthorizedResponse();
      }

      const url = new URL(this.request.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());

      // Apply defaults manually
      const paramsWithDefaults = {
        page: 1,
        limit: 100,
        sort_by: 'created_at' as const,
        sort_order: 'desc' as const,
        ...queryParams
      };

      this.validatedData = this.rules().parse(paramsWithDefaults);
      return null;

    } catch (error) {
      if (error instanceof ZodError) {
        return this.handleZodValidationError(error);
      }
      return this.invalidJsonResponse();
    }
  }

  private handleZodValidationError(error: ZodError): NextResponse {
    const firstError = error.errors[0];
    
    console.log('Query Validation Error:', {
      message: firstError.message,
      path: firstError.path,
      code: firstError.code,
    });

    return NextResponse.json(
      {
        error: {
          code: 400,
          message: `Invalid query parameter '${firstError.path.join('.')}': ${firstError.message}`,
        },
      },
      { status: 400 }
    );
  }

  // Utility methods
  getPage(): number {
    return this.validated().page;
  }

  getLimit(): number {
    return this.validated().limit;
  }

  getOffset(): number {
    return (this.getPage() - 1) * this.getLimit();
  }

  getSearch(): string | undefined {
    return this.validated().search;
  }

  getProgramId(): number | undefined {
    return this.validated().program_id;
  }

  getDegreeId(): number | undefined {
    return this.validated().degree_id;
  }

  getYear(): number | undefined {
    return this.validated().year;
  }

  getSortBy(): string {
    return this.validated().sort_by;
  }

  getSortOrder(): 'asc' | 'desc' {
    return this.validated().sort_order;
  }

  hasFilters(): boolean {
    const data = this.validated();
    return !!(data.search || data.program_id || data.degree_id || data.year);
  }

  getActiveFilters() {
    const data = this.validated();
    const filters: Record<string, string | number> = {};
    
    if (data.search) filters.search = data.search;
    if (data.program_id) filters.program_id = data.program_id;
    if (data.degree_id) filters.degree_id = data.degree_id;
    if (data.year) filters.year = data.year;
    
    return filters;
  }
}