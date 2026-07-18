/**
 * @file VirtualPad.cpp
 * @author Luis Camilo Alvarez Carrau
 * @brief Class implementation for a virtual game pad.
 * @version 0.1
 * @date 2026-07-18
 * 
 */
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

    g_padActive = false;
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

Napi::Value VirtualPad::startController(const Napi::CallbackInfo &info)
{
    if (g_padActive) {
        return Napi::Value();
    }

    m_thread = std::thread(TestThreaded, std::ref(g_padActive));




    
    if (m_thread.joinable()) {
        m_thread.join();
    }



    return Napi::Value();


}

Napi::Function VirtualPad::GetClass(Napi::Env env)
{
    return DefineClass(
        env,
        "VirtualPad",
        {
            VirtualPad::InstanceMethod("test", &VirtualPad::test),
            VirtualPad::InstanceMethod("startController", &VirtualPad::startController),

        }
    );

}

std::atomic<bool>& VirtualPad::getPadActive()
{
    return g_padActive;
}

std::thread &VirtualPad::getPadThread()
{
    return m_thread;
    // TODO: insert return statement here
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

void TestThreaded(std::atomic<bool>& active)
{
    if (active) {
        return;
    }
    active = true;

    for (uint32_t i = 0; i < 10000; i++) {
        printf("And that is %d", i);

        std::this_thread::sleep_for(std::chrono::seconds(1)); 
    }

}
