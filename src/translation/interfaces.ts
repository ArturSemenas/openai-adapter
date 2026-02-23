/**
 * Translation interfaces following Interface Segregation Principle
 * Separate interfaces for request vs response translation
 */

/**
 * Base translation result
 */
export interface TranslationResult<T = unknown> {
  success: boolean;
  translated?: T;
  error?: string;
  unknownFields: string[];
}

/**
 * Translation options passed to translators
 */
export interface TranslationOptions {
  requestId: string;
  strict?: boolean; // If true, fail on unknown fields
}

/**
 * Request translator interface (ISP-compliant)
 * 
 * Handles translation of incoming requests between API formats.
 * Segregated from ResponseTranslator to follow Interface Segregation Principle.
 * 
 * @template TInput - The input request type (source format)
 * @template TOutput - The output request type (target format)
 * 
 * @example
 * ```typescript
 * // Create a translator for Chat Completions → Response API
 * const translator: RequestTranslator<ChatCompletionsRequest, ResponseApiRequest> = 
 *   new ChatToResponseRequestTranslator();
 * 
 * // Validate and translate
 * if (translator.isValidRequest(request)) {
 *   const result = translator.translateRequest(request, { requestId: '123' });
 *   if (result.success) {
 *     console.log('Translated:', result.translated);
 *   }
 * }
 * ```
 */
export interface RequestTranslator<TInput = unknown, TOutput = unknown> {
  /**
   * Translate a request from one format to another
   * 
   * Performs the actual translation logic, converting the input request
   * to the target format. Returns a result object containing either the
   * translated request or an error message.
   * 
   * @param request - The request to translate (must match TInput type)
   * @param options - Translation options including requestId and optional strict mode
   * @returns Translation result with translated request or error details
   * 
   * @example
   * ```typescript
   * const result = translator.translateRequest(chatRequest, { 
   *   requestId: 'req-123',
   *   strict: false 
   * });
   * 
   * if (result.success) {
   *   // Use result.translated
   * } else {
   *   // Handle result.error
   * }
   * ```
   */
  translateRequest(
    request: TInput,
    options: TranslationOptions
  ): TranslationResult<TOutput>;

  /**
   * Validate that a request matches the expected input format
   * 
   * Performs type checking and structural validation to ensure the request
   * can be safely translated. Should be called before translateRequest to
   * avoid runtime errors.
   * 
   * @param request - The request to validate (unknown type for flexibility)
   * @returns true if request is valid for this translator, false otherwise
   * 
   * @example
   * ```typescript
   * if (translator.isValidRequest(unknownRequest)) {
   *   // Safe to translate
   *   const result = translator.translateRequest(unknownRequest, options);
   * } else {
   *   // Invalid format, handle error
   * }
   * ```
   */
  isValidRequest(request: unknown): boolean;
}

/**
 * Response translator interface (ISP-compliant)
 * 
 * Handles translation of API responses back to the original format.
 * Segregated from RequestTranslator to follow Interface Segregation Principle.
 * 
 * This interface is used for the return path of bidirectional translation:
 * after a request is translated and sent upstream, the response must be
 * translated back to match the caller's expected format.
 * 
 * @template TInput - The input response type (upstream format)
 * @template TOutput - The output response type (caller's expected format)
 * 
 * @example
 * ```typescript
 * // Create a translator for Response API → Chat Completions
 * const translator: ResponseTranslator<ResponseApiResponse, ChatCompletionsResponse> = 
 *   new ResponseToChatResponseTranslator();
 * 
 * // Validate and translate upstream response
 * if (translator.isValidResponse(upstreamResponse)) {
 *   const result = translator.translateResponse(upstreamResponse, { requestId: '123' });
 *   if (result.success) {
 *     // Return result.translated to caller
 *   }
 * }
 * ```
 */
export interface ResponseTranslator<TInput = unknown, TOutput = unknown> {
  /**
   * Translate a response from one format to another
   * 
   * Converts the upstream API response back to the format expected by
   * the original caller. This completes the bidirectional translation cycle.
   * 
   * @param response - The response to translate (must match TInput type)
   * @param options - Translation options including requestId for correlation
   * @returns Translation result with translated response or error details
   * 
   * @example
   * ```typescript
   * const result = translator.translateResponse(upstreamResponse, { 
   *   requestId: 'req-123' 
   * });
   * 
   * if (result.success) {
   *   // Return result.translated to caller
   * } else {
   *   // Handle result.error
   * }
   * ```
   */
  translateResponse(
    response: TInput,
    options: TranslationOptions
  ): TranslationResult<TOutput>;

  /**
   * Validate that a response matches the expected input format
   * 
   * Performs type checking and structural validation to ensure the response
   * can be safely translated. Should be called before translateResponse to
   * avoid runtime errors.
   * 
   * @param response - The response to validate (unknown type for flexibility)
   * @returns true if response is valid for this translator, false otherwise
   * 
   * @example
   * ```typescript
   * if (translator.isValidResponse(upstreamResponse)) {
   *   // Safe to translate
   *   const result = translator.translateResponse(upstreamResponse, options);
   * } else {
   *   // Invalid format, handle error
   * }
   * ```
   */
  isValidResponse(response: unknown): boolean;
}
