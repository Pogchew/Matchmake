"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

let pendingOwnerAccessCheck = null;

async function getOwnerAccess() {
  if (!pendingOwnerAccessCheck) {
    pendingOwnerAccessCheck = supabase
      .rpc("is_matchmake_owner")
      .then(({ data, error }) => !error && data === true);
  }

  try {
    return await pendingOwnerAccessCheck;
  } finally {
    pendingOwnerAccessCheck = null;
  }
}

export function useOwnerAccess() {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkOwnerAccess() {
      const hasOwnerAccess = await getOwnerAccess();
      if (isMounted) setIsOwner(hasOwnerAccess);
    }

    checkOwnerAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  return isOwner;
}
