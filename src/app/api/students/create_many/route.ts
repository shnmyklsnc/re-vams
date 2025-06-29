import { createClient } from "@/app/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { CreateManyStudentsRequest } from "@/lib/requests/students/CreateManyStudentsRequest";

export async function POST(request: NextRequest) {
  //custom validation
  const customRequest = new CreateManyStudentsRequest(request);
  const validationError = await customRequest.validate();
  
  if (validationError) {
    return validationError; //return custom validation error
  }

  try {
    const students = customRequest.getStudents();

    // Database operation
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('students')
      .insert(students)
      .select();

    if (error) {
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

    // Response formatting
    return NextResponse.json(
      {
        students: data.map((obj) =>
          Object.fromEntries(
            Object.entries(obj).sort(([keyA], [keyB]) =>
              keyA.localeCompare(keyB)
            )
          )
        ),
      },
      { status: 201 }
    );

  } catch (e) {
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