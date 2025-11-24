import { useEffect, useState } from "react";

/**
 * Custom hook that debounces a value
 *
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 500ms)
 * @returns The debounced value
 *
 * @example
 * const [searchQuery, setSearchQuery] = useState("");
 * const debouncedSearch = useDebounce(searchQuery, 500);
 *
 * useEffect(() => {
 *   // API call with debouncedSearch
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook that provides a debounced callback function
 *
 * @param callback - The callback function to debounce
 * @param delay - The delay in milliseconds (default: 500ms)
 * @returns Object with the debounced function and a boolean indicating if it's pending
 *
 * @example
 * const { debouncedFn, isPending } = useDebouncedCallback(
 *   (query: string) => fetchData(query),
 *   500
 * );
 *
 * <Input onChange={(e) => debouncedFn(e.target.value)} />
 * {isPending && <Loader />}
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500,
): {
  debouncedFn: T;
  isPending: boolean;
  cancel: () => void;
} {
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useState<NodeJS.Timeout | null>(null);

  const debouncedFn = ((...args: Parameters<T>) => {
    setIsPending(true);

    if (timeoutRef[0]) {
      clearTimeout(timeoutRef[0]);
    }

    timeoutRef[0] = setTimeout(() => {
      callback(...args);
      setIsPending(false);
    }, delay);
  }) as T;

  const cancel = () => {
    if (timeoutRef[0]) {
      clearTimeout(timeoutRef[0]);
      setIsPending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef[0]) {
        clearTimeout(timeoutRef[0]);
      }
    };
  }, [timeoutRef[0]]);

  return { debouncedFn, isPending, cancel };
}
