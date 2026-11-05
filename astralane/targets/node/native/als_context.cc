#include <node_api.h>
#include <thread>

static napi_threadsafe_function callback_handle = nullptr;
static napi_ref callback_ref = nullptr;

static void invoke_callback(napi_env env, napi_value callback, void*, void*) {
  if (env == nullptr || callback_ref == nullptr) return;
  napi_value stored;
  if (napi_get_reference_value(env, callback_ref, &stored) != napi_ok) return;
  napi_value global;
  napi_get_global(env, &global);
  napi_call_function(env, global, stored, 0, nullptr, nullptr);
}

static napi_value start(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "callback is required");
    return nullptr;
  }

  if (callback_ref != nullptr) {
    napi_delete_reference(env, callback_ref);
  }
  napi_create_reference(env, argv[0], 1, &callback_ref);

  std::thread([] {
    napi_call_threadsafe_function(callback_handle, nullptr, napi_tsfn_blocking);
  }).detach();

  return nullptr;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "start", NAPI_AUTO_LENGTH, start, nullptr, &fn);
  napi_set_named_property(env, exports, "start", fn);

  napi_value resource_name;
  napi_create_string_utf8(env, "als_context", NAPI_AUTO_LENGTH, &resource_name);
  napi_create_threadsafe_function(
    env, nullptr, nullptr, resource_name, 0, 1, nullptr, nullptr, nullptr,
    invoke_callback, &callback_handle
  );

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
