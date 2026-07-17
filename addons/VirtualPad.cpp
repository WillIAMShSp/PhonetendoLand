#include "VirtualPad.h"



VirtualPad::VirtualPad(const Napi::CallbackInfo &info)
    : ObjectWrap(info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        throwError(env, "Incorrect number of arguments!");

        return;
    }

    if (!info[0].IsString()) {
        throwError(env, "Class must be named as first parameter");
        return;
    }

    playerId = info[0].As<Napi::String>().Utf8Value();
}

Napi::Value VirtualPad::test(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        throwError(env, "Incorrect number of arguments");
        return env.Null();
    }
    if (!info[0].IsString()) {
        throwError(env, "Data needed");
        return env.Null();
    }

    Napi::String input = info[0].As<Napi::String>();

    printf("Hello %s\n", input.Utf8Value().c_str());

    return Napi::Value();
}

Napi::Function VirtualPad::GetClass(Napi::Env env)
{
    return DefineClass(
        env,
        "VirtualPad",
        {
            VirtualPad::InstanceMethod("test", &VirtualPad::test),

        }
    );

}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::String name = Napi::String::New(env, "VirtualPad");
    exports.Set(name, VirtualPad::GetClass(env));
    return exports;
}

NODE_API_MODULE(addon, Init);



void throwError(Napi::Env& env, const char *message)
{
    Napi::TypeError::New(env, message).ThrowAsJavaScriptException();

}
