import { createClient } from "@/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { GetStudentRequest } from "@/lib/requests/students/GetStudentRequest";
import { UpdateStudentRequest } from "@/lib/requests/students/UpdateStudentRequest";

// GET /api/students/[id] - Get a single student by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const customRequest = new GetStudentRequest(request, params.id);
  const validationError = await customRequest.validate();
  
  if (validationError) {
    return validationError;
  }

  try {
    const studentId = customRequest.getStudentId();
    const supabase = await createClient();

    // Fetch student with related data
    const { data: student, error } = await supabase
      .from('students')
      .select(`
        *,
        programs!program_id(id, name, major),
        degrees!degree_id(id, name)
      `)
      .eq('id', studentId)
      .single();

    if (error || !student) {
      return NextResponse.json(
        {
          error: {
            code: 404,
            message: `Student with ID '${studentId}' not found.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        student: Object.fromEntries(
          Object.entries(student).sort(([keyA], [keyB]) =>
            keyA.localeCompare(keyB)
          )
        ),
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

// PATCH /api/students/[id] - Update a student
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const customRequest = new UpdateStudentRequest(request, params.id);
  const validationError = await customRequest.validate();
  
  if (validationError) {
    return validationError;
  }

  try {
    const studentId = customRequest.getStudentId();
    const updateData = customRequest.getUpdateData();
    const supabase = await createClient();

    // Check if student exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .single();

    if (!existingStudent) {
      return NextResponse.json(
        {
          error: {
            code: 404,
            message: `Student with ID '${studentId}' not found.`,
          },
        },
        { status: 404 }
      );
    }

    // If updating program_id or degree_id, verify they exist
    if (updateData.program_id || updateData.degree_id) {
      const checks = [];
      
      if (updateData.program_id) {
        checks.push(
          supabase.from('programs').select('id').eq('id', updateData.program_id).single()
        );
      }
      
      if (updateData.degree_id) {
        checks.push(
          supabase.from('degrees').select('id').eq('id', updateData.degree_id).single()
        );
      }

      const results = await Promise.all(checks);
      
      let index = 0;
      if (updateData.program_id) {
        if (results[index].error) {
          return NextResponse.json(
            {
              error: {
                code: 400,
                message: `Program with ID ${updateData.program_id} does not exist.`,
              },
            },
            { status: 400 }
          );
        }
        index++;
      }
      
      if (updateData.degree_id) {
        if (results[index].error) {
          return NextResponse.json(
            {
              error: {
                code: 400,
                message: `Degree with ID ${updateData.degree_id} does not exist.`,
              },
            },
            { status: 400 }
          );
        }
      }
    }

    // Update the student
    const { data: updatedStudent, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', studentId)
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
          Object.entries(updatedStudent).sort(([keyA], [keyB]) =>
            keyA.localeCompare(keyB)
          )
        ),
        message: `Student '${studentId}' updated successfully.`,
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

// DELETE /api/students/[id] - Delete a student
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const customRequest = new GetStudentRequest(request, params.id);
  const validationError = await customRequest.validate();
  
  if (validationError) {
    return validationError;
  }

  try {
    const studentId = customRequest.getStudentId();
    const supabase = await createClient();

    // Check if student exists
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .single();

    if (!existingStudent) {
      return NextResponse.json(
        {
          error: {
            code: 404,
            message: `Student with ID '${studentId}' not found.`,
          },
        },
        { status: 404 }
      );
    }

    // Delete the student
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

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
        message: `Student '${existingStudent.first_name} ${existingStudent.last_name}' (ID: ${studentId}) deleted successfully.`,
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