import { createClient } from "@/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { GetStudentsRequest } from "@/lib/requests/students/GetStudentsRequest";
import { CreateStudentRequest } from "@/lib/requests/students/CreateStudentRequest";

// GET /api/students - List students with pagination and filtering
export async function GET(request: NextRequest) {
  const customRequest = new GetStudentsRequest(request);
  const validationError = await customRequest.validate();
  
  if (validationError) {
    return validationError;
  }

  try {
    const supabase = await createClient();
    
    // Build the query
    let query = supabase
      .from('students')
      .select(`
        *,
        programs!program_id(id, name, major),
        degrees!degree_id(id, name)
      `, { count: 'exact' });

    // Apply filters
    if (customRequest.getSearch()) {
      const search = customRequest.getSearch()!;
      query = query.or(`id.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email_address.ilike.%${search}%`);
    }

    const programId = customRequest.getProgramId();
    if (programId) {
      query = query.eq('program_id', programId);
    }

    const degreeId = customRequest.getDegreeId();
    if (degreeId) {
      query = query.eq('degree_id', degreeId);
    }

    const year = customRequest.getYear();
    if (year) {
      query = query.eq('year', year);
    }

    // Apply sorting
    query = query.order(customRequest.getSortBy(), { ascending: customRequest.getSortOrder() === 'asc' });

    // Apply pagination
    query = query.range(customRequest.getOffset(), customRequest.getOffset() + customRequest.getLimit() - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        {
          error: {
            code: 400,
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / customRequest.getLimit());
    const hasNextPage = customRequest.getPage() < totalPages;
    const hasPrevPage = customRequest.getPage() > 1;

    return NextResponse.json(
      {
        students: data?.map((student) =>
          Object.fromEntries(
            Object.entries(student).sort(([keyA], [keyB]) =>
              keyA.localeCompare(keyB)
            )
          )
        ) || [],
        pagination: {
          page: customRequest.getPage(),
          limit: customRequest.getLimit(),
          total: count || 0,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        filters: customRequest.getActiveFilters(),
        sort: {
          by: customRequest.getSortBy(),
          order: customRequest.getSortOrder(),
        },
      },
      { status: 200 }
    );

  } catch (e) {
    console.error('Route error:', e);
    return NextResponse.json(
      {
        error: {
          code: 500,
          message: (e as Error).message || "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/students - Create a single student
export async function POST(request: NextRequest) {
  const customRequest = new CreateStudentRequest(request);
  const validationError = await customRequest.validate();
  
  if (validationError) {
    return validationError;
  }

  try {
    const studentData = customRequest.getStudentData();

    // Check if student ID already exists
    const supabase = await createClient();
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentData.id)
      .single();

    if (existingStudent) {
      return NextResponse.json(
        {
          error: {
            code: 409,
            message: `Student with ID '${studentData.id}' already exists.`,
          },
        },
        { status: 409 }
      );
    }

    // Verify that program_id and degree_id exist
    const [programCheck, degreeCheck] = await Promise.all([
      supabase.from('programs').select('id').eq('id', studentData.program_id).single(),
      supabase.from('degrees').select('id').eq('id', studentData.degree_id).single()
    ]);

    if (programCheck.error) {
      return NextResponse.json(
        {
          error: {
            code: 400,
            message: `Program with ID ${studentData.program_id} does not exist.`,
          },
        },
        { status: 400 }
      );
    }

    if (degreeCheck.error) {
      return NextResponse.json(
        {
          error: {
            code: 400,
            message: `Degree with ID ${studentData.degree_id} does not exist.`,
          },
        },
        { status: 400 }
      );
    }

    // Create the student
    const { data, error } = await supabase
      .from('students')
      .insert(studentData)
      .select(`
        *,
        programs!program_id(id, name, major),
        degrees!degree_id(id, name)
      `)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        {
          error: {
            code: 400,
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        student: Object.fromEntries(
          Object.entries(data).sort(([keyA], [keyB]) =>
            keyA.localeCompare(keyB)
          )
        ),
        message: `Student '${customRequest.getFullName()}' created successfully.`,
      },
      { status: 201 }
    );

  } catch (e) {
    console.error('Route error:', e);
    return NextResponse.json(
      {
        error: {
          code: 500,
          message: (e as Error).message || "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}